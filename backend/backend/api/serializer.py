from django.contrib.auth.models import User
from datetime import time
from django.db import transaction
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import (
    Appointment,
    ConsultationReport,
    DoctorProfile,
    DoctorSlot,
    DoctorWeeklyAvailability,
    PatientMedicalProfile,
    UserProfile,
)


SHIFT_WINDOWS = {
    "morning": (time(9, 0), time(12, 0)),
    "evening": (time(13, 0), time(16, 0)),
    "night": (time(18, 0), time(21, 0)),
}

SHIFT_LABELS = {
    "morning": "Morning (09:00-12:00)",
    "evening": "Evening (13:00-16:00)",
    "night": "Night (18:00-21:00)",
}

MEDICAL_TEXT_NA_FIELDS = (
    "allergies",
    "chronic_conditions",
    "current_medications",
    "major_past_surgeries",
)

PUBLIC_REGISTRATION_ROLES = (
    ("patient", "Patient"),
    ("doctor", "Doctor"),
)

APPOINTMENT_LIMIT_PER_SLOT = 15
ACTIVE_SLOT_STATUSES = ("pending", "confirmed", "completed")
MOBILE_NUMBER_LENGTH = 10
MIN_DOCTOR_PRACTICE_START_AGE = 21


def normalize_mobile_number(value):
    clean = str(value or "").strip()
    if not clean:
        return ""

    digits_only = "".join(ch for ch in clean if ch.isdigit())
    if len(digits_only) != MOBILE_NUMBER_LENGTH:
        raise serializers.ValidationError(
            f"Mobile number must be exactly {MOBILE_NUMBER_LENGTH} digits."
        )
    return digits_only


def get_user_display_name(user):
    first_name = (getattr(user, "first_name", "") or "").strip()
    last_name = (getattr(user, "last_name", "") or "").strip()
    full_name = " ".join(part for part in [first_name, last_name] if part)
    return full_name or (getattr(user, "username", "") or "")


def infer_shift_type(start_time, end_time):
    for shift_type, (start, end) in SHIFT_WINDOWS.items():
        if start_time == start and end_time == end:
            return shift_type
    return "custom"


def get_slot_occupancy(slot, exclude_appointment_id=None):
    queryset = Appointment.objects.filter(slot=slot, status__in=ACTIVE_SLOT_STATUSES)
    if exclude_appointment_id is not None:
        queryset = queryset.exclude(id=exclude_appointment_id)
    return queryset.count()


def ensure_slot_can_accept_appointment(slot, exclude_appointment_id=None):
    if not slot.is_available:
        raise serializers.ValidationError({"slot_id": "Slot is not available."})
    if not slot.doctor.is_active:
        raise serializers.ValidationError({"slot_id": "Doctor is not active."})

    occupied = get_slot_occupancy(slot, exclude_appointment_id=exclude_appointment_id)
    if occupied >= APPOINTMENT_LIMIT_PER_SLOT:
        raise serializers.ValidationError({"slot_id": f"Slot is full. Maximum {APPOINTMENT_LIMIT_PER_SLOT} appointments allowed."})


class RegisterSerializer(serializers.ModelSerializer):
    role = serializers.ChoiceField(choices=PUBLIC_REGISTRATION_ROLES, write_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "password", "role"]
        extra_kwargs = {"password": {"write_only": True}}

    def create(self, validated_data):
        role = validated_data.pop("role")
        user = User.objects.create_user(**validated_data)
        UserProfile.objects.create(user=user, role=role)
        if role == "doctor":
            DoctorProfile.objects.create(user=user, speciality="General")
        return user

def is_doctor_profile_complete(doctor_profile):
    return (
        bool((doctor_profile.speciality or "").strip())
        and doctor_profile.experience_years is not None
        and bool((doctor_profile.qualification or "").strip())
    )


def is_patient_profile_complete(user, medical_profile):
    try:
        normalized_mobile = normalize_mobile_number(medical_profile.mobile)
    except serializers.ValidationError:
        normalized_mobile = ""

    return (
        bool((user.first_name or "").strip())
        and bool((user.last_name or "").strip())
        and bool(normalized_mobile)
        and medical_profile.age is not None
        and bool((medical_profile.gender or "").strip())
        and bool((medical_profile.blood_group or "").strip())
        and medical_profile.blood_group != "UNKNOWN"
    )

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        profile, _ = UserProfile.objects.get_or_create(user=user, defaults={"role": "patient"})
        token = super().get_token(user)
        token["role"] = profile.role
        token["profile_completed"] = profile.profile_completed
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        profile, _ = UserProfile.objects.get_or_create(user=self.user, defaults={"role": "patient"})
        role = profile.role
        is_complete = role == "admin"
        if role == "doctor":
            doctor_profile = DoctorProfile.objects.filter(user=self.user).first()
            is_complete = bool(doctor_profile and is_doctor_profile_complete(doctor_profile))
        elif role == "patient":
            medical_profile, _ = PatientMedicalProfile.objects.get_or_create(user=self.user)
            is_complete = is_patient_profile_complete(self.user, medical_profile)

        if profile.profile_completed != is_complete:
            profile.profile_completed = is_complete
            profile.save(update_fields=["profile_completed"])

        data["role"] = profile.role
        data["username"] = self.user.username
        data["profile_completed"] = is_complete
        return data


class DoctorProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    display_name = serializers.SerializerMethodField(read_only=True)
    first_name = serializers.CharField(source="user.first_name", required=False, allow_blank=True)
    last_name = serializers.CharField(source="user.last_name", required=False, allow_blank=True)
    email = serializers.EmailField(source="user.email", required=False, allow_blank=True)
    doctor_id = serializers.IntegerField(source="id", read_only=True)

    class Meta:
        model = DoctorProfile
        fields = [
            "doctor_id",
            "username",
            "display_name",
            "first_name",
            "last_name",
            "email",
            "speciality",
            "experience_years",
            "age",
            "qualification",
            "bio",
            "is_active",
        ]

    def get_display_name(self, obj):
        return get_user_display_name(obj.user)

    def validate(self, attrs):
        age = attrs.get("age", getattr(self.instance, "age", None))
        experience_years = attrs.get("experience_years", getattr(self.instance, "experience_years", None))

        if age is None or experience_years is None:
            return attrs

        if experience_years > age:
            raise serializers.ValidationError(
                {"experience_years": "Experience cannot be greater than age."}
            )

        max_realistic_experience = max(0, age - MIN_DOCTOR_PRACTICE_START_AGE)
        if experience_years > max_realistic_experience:
            raise serializers.ValidationError(
                {
                    "experience_years": (
                        "Experience is unrealistic for the provided age. "
                        f"Maximum allowed is {max_realistic_experience} years for age {age}."
                    )
                }
            )

        return attrs

    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", {})
        for attr, value in user_data.items():
            setattr(instance.user, attr, value)
        if user_data:
            instance.user.save(update_fields=list(user_data.keys()))

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance

class PatientMedicalProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    first_name = serializers.CharField(source="user.first_name", required=False, allow_blank=True)
    last_name = serializers.CharField(source="user.last_name", required=False, allow_blank=True)
    email = serializers.EmailField(source="user.email", required=False, allow_blank=True)

    class Meta:
        model = PatientMedicalProfile
        fields = [
            "username",
            "first_name",
            "last_name",
            "email",
            "mobile",
            "age",
            "gender",
            "height_cm",
            "weight_kg",
            "disability_notes",
            "blood_group",
            "previous_diagnosis",
            "allergies",
            "chronic_conditions",
            "current_medications",
            "major_past_surgeries",
        ]

    def validate_mobile(self, value):
        return normalize_mobile_number(value)

    def validate(self, attrs):
        for field_name in MEDICAL_TEXT_NA_FIELDS:
            if field_name not in attrs:
                continue
            value = attrs.get(field_name)
            if value is None or not str(value).strip():
                attrs[field_name] = "NA"
        return attrs

    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", {})
        for attr, value in user_data.items():
            setattr(instance.user, attr, value)
        if user_data:
            instance.user.save(update_fields=list(user_data.keys()))

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance

class DoctorSlotSerializer(serializers.ModelSerializer):
    doctor_id = serializers.IntegerField(source="doctor.id", read_only=True)
    shift_type = serializers.SerializerMethodField()
    shift_label = serializers.SerializerMethodField()
    remaining_capacity = serializers.SerializerMethodField()

    class Meta:
        model = DoctorSlot
        fields = [
            "id",
            "doctor_id",
            "date",
            "start_time",
            "end_time",
            "shift_type",
            "shift_label",
            "is_available",
            "remaining_capacity",
        ]

    def validate(self, attrs):
        start_time = attrs.get("start_time", getattr(self.instance, "start_time", None))
        end_time = attrs.get("end_time", getattr(self.instance, "end_time", None))
        if start_time and end_time and start_time >= end_time:
            raise serializers.ValidationError("start_time must be before end_time.")
        return attrs

    def get_shift_type(self, obj):
        return infer_shift_type(obj.start_time, obj.end_time)

    def get_shift_label(self, obj):
        shift_type = infer_shift_type(obj.start_time, obj.end_time)
        return SHIFT_LABELS.get(shift_type, "Custom")

    def get_remaining_capacity(self, obj):
        occupied = getattr(obj, "active_appointments", None)
        if occupied is None:
            occupied = get_slot_occupancy(obj)
        return max(0, APPOINTMENT_LIMIT_PER_SLOT - occupied)


class DoctorWeeklyAvailabilitySerializer(serializers.ModelSerializer):
    doctor_id = serializers.IntegerField(source="doctor.id", read_only=True)
    weekday_name = serializers.CharField(source="get_weekday_display", read_only=True)
    shift_type = serializers.ChoiceField(choices=list(SHIFT_WINDOWS.keys()), write_only=True, required=False)
    shift_label = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = DoctorWeeklyAvailability
        fields = [
            "id",
            "doctor_id",
            "weekday",
            "weekday_name",
            "shift_type",
            "shift_label",
            "start_time",
            "end_time",
            "is_active",
        ]
        read_only_fields = ["start_time", "end_time"]

    def get_shift_label(self, obj):
        shift_type = infer_shift_type(obj.start_time, obj.end_time)
        return SHIFT_LABELS.get(shift_type, "Custom")

    def validate(self, attrs):
        if self.instance is None and "shift_type" not in attrs:
            raise serializers.ValidationError({"shift_type": "This field is required."})
        return attrs

    def create(self, validated_data):
        shift_type = validated_data.pop("shift_type")
        start_time, end_time = SHIFT_WINDOWS[shift_type]
        validated_data["start_time"] = start_time
        validated_data["end_time"] = end_time
        return super().create(validated_data)

    def update(self, instance, validated_data):
        shift_type = validated_data.pop("shift_type", None)
        if shift_type:
            start_time, end_time = SHIFT_WINDOWS[shift_type]
            validated_data["start_time"] = start_time
            validated_data["end_time"] = end_time
        return super().update(instance, validated_data)


class AppointmentSerializer(serializers.ModelSerializer):
    doctor_name = serializers.SerializerMethodField()
    doctor_speciality = serializers.CharField(source="doctor.speciality", read_only=True)
    patient_name = serializers.SerializerMethodField()
    slot_date = serializers.DateField(source="slot.date", read_only=True)
    slot_start_time = serializers.TimeField(source="slot.start_time", read_only=True)
    slot_end_time = serializers.TimeField(source="slot.end_time", read_only=True)

    class Meta:
        model = Appointment
        fields = [
            "id",
            "status",
            "reason",
            "patient",
            "patient_name",
            "doctor",
            "doctor_name",
            "doctor_speciality",
            "slot",
            "slot_date",
            "slot_start_time",
            "slot_end_time",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["patient", "doctor", "created_at", "updated_at"]

    def get_doctor_name(self, obj):
        return get_user_display_name(obj.doctor.user)

    def get_patient_name(self, obj):
        return get_user_display_name(obj.patient)


class AppointmentStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["pending", "confirmed", "cancelled"])


class BookAppointmentSerializer(serializers.Serializer):
    slot_id = serializers.IntegerField()
    reason = serializers.CharField(required=False, allow_blank=True)

    @transaction.atomic
    def create(self, validated_data):
        patient = self.context["request"].user
        slot = DoctorSlot.objects.select_for_update().select_related("doctor", "doctor__user").filter(
            id=validated_data["slot_id"]
        ).first()
        if not slot:
            raise serializers.ValidationError({"slot_id": "Slot not found."})
        ensure_slot_can_accept_appointment(slot)

        return Appointment.objects.create(
            patient=patient,
            doctor=slot.doctor,
            slot=slot,
            status="pending",
            reason=validated_data.get("reason", ""),
        )

class RescheduleAppointmentSerializer(serializers.Serializer):
    slot_id = serializers.IntegerField()

    @transaction.atomic
    def update(self, instance, validated_data):
        request = self.context.get("request")
        request_user = getattr(request, "user", None)
        request_role = getattr(getattr(request_user, "profile", None), "role", None)

        new_slot = DoctorSlot.objects.select_for_update().select_related("doctor", "doctor__user").filter(
            id=validated_data["slot_id"]
        ).first()
        if not new_slot:
            raise serializers.ValidationError({"slot_id": "Slot not found."})
        if request_role == "patient" and new_slot.doctor_id != instance.doctor_id:
            raise serializers.ValidationError({"slot_id": "Patients can only reschedule within the same doctor."})
        if request_role == "doctor" and new_slot.doctor.user_id != request_user.id:
            raise serializers.ValidationError({"slot_id": "Doctors can only use their own slots."})

        ensure_slot_can_accept_appointment(new_slot, exclude_appointment_id=instance.id)

        instance.slot = new_slot
        instance.doctor = new_slot.doctor
        instance.status = "pending"
        instance.save(update_fields=["slot", "doctor", "status", "updated_at"])
        return instance


class ConsultationReportSerializer(serializers.ModelSerializer):
    doctor_name = serializers.SerializerMethodField()

    class Meta:
        model = ConsultationReport
        fields = [
            "id",
            "appointment",
            "doctor",
            "doctor_name",
            "diagnosis",
            "prescription",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["doctor", "appointment", "created_at", "updated_at"]

    def get_doctor_name(self, obj):
        return get_user_display_name(obj.doctor.user)


class PatientMedicalProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    first_name = serializers.CharField(source="user.first_name", required=False, allow_blank=True)
    last_name = serializers.CharField(source="user.last_name", required=False, allow_blank=True)
    email = serializers.EmailField(source="user.email", required=False, allow_blank=True)

    class Meta:
        model = PatientMedicalProfile
        fields = [
            "username",
            "first_name",
            "last_name",
            "email",
            "mobile",
            "age",
            "gender",
            "height_cm",
            "weight_kg",
            "disability_notes",
            "blood_group",
            "previous_diagnosis",
            "allergies",
            "chronic_conditions",
            "current_medications",
            "major_past_surgeries",
        ]

    def validate_mobile(self, value):
        return normalize_mobile_number(value)

    def validate(self, attrs):
        for field_name in MEDICAL_TEXT_NA_FIELDS:
            if field_name not in attrs:
                continue
            value = attrs.get(field_name)
            if value is None or not str(value).strip():
                attrs[field_name] = "NA"
        return attrs

    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", {})
        for attr, value in user_data.items():
            setattr(instance.user, attr, value)
        if user_data:
            instance.user.save(update_fields=list(user_data.keys()))

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance

class AdminDoctorCreateSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True, min_length=8)
    speciality = serializers.CharField()
    experience_years = serializers.IntegerField(min_value=0)
    qualification = serializers.CharField(required=False, allow_blank=True)
    bio = serializers.CharField(required=False, allow_blank=True)

    @transaction.atomic
    def create(self, validated_data):
        username = validated_data.pop("username")
        password = validated_data.pop("password")

        if User.objects.filter(username=username).exists():
            raise serializers.ValidationError({"username": "Username already exists."})

        user = User.objects.create_user(username=username, password=password)
        UserProfile.objects.create(user=user, role="doctor")
        return DoctorProfile.objects.create(user=user, **validated_data)


class AdminUserListSerializer(serializers.ModelSerializer):
    role = serializers.CharField(source="profile.role", read_only=True)
    doctor_speciality = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "email",
            "role",
            "is_active",
            "doctor_speciality",
        ]

    def get_doctor_speciality(self, obj):
        doctor_profile = getattr(obj, "doctor_profile", None)
        if not doctor_profile:
            return ""
        return doctor_profile.speciality


class AdminUserDetailSerializer(serializers.ModelSerializer):
    role = serializers.CharField(source="profile.role", read_only=True)
    doctor_profile = serializers.SerializerMethodField()
    patient_profile = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "email",
            "date_joined",
            "is_active",
            "role",
            "doctor_profile",
            "patient_profile",
        ]

    def get_doctor_profile(self, obj):
        doctor_profile = getattr(obj, "doctor_profile", None)
        if not doctor_profile:
            return None
        return {
            "speciality": doctor_profile.speciality,
            "experience_years": doctor_profile.experience_years,
            "age": doctor_profile.age,
            "qualification": doctor_profile.qualification,
            "bio": doctor_profile.bio,
            "is_active": doctor_profile.is_active,
        }

    def get_patient_profile(self, obj):
        patient_profile = getattr(obj, "medical_profile", None)
        if not patient_profile:
            return None
        return {
            "mobile": patient_profile.mobile,
            "age": patient_profile.age,
            "gender": patient_profile.gender,
            "blood_group": patient_profile.blood_group,
            "height_cm": patient_profile.height_cm,
            "weight_kg": patient_profile.weight_kg,
            "disability_notes": patient_profile.disability_notes,
            "previous_diagnosis": patient_profile.previous_diagnosis,
            "allergies": patient_profile.allergies,
            "chronic_conditions": patient_profile.chronic_conditions,
            "current_medications": patient_profile.current_medications,
            "major_past_surgeries": patient_profile.major_past_surgeries,
        }


class AdminUserStatusSerializer(serializers.Serializer):
    is_active = serializers.BooleanField()
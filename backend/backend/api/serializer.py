from django.contrib.auth.models import User
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

class RegisterSerializer(serializers.ModelSerializer):
    role = serializers.ChoiceField(choices=UserProfile.ROLE_CHOICES, write_only=True)

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
    return (
        bool((user.first_name or "").strip())
        and bool((user.last_name or "").strip())
        and bool((medical_profile.mobile or "").strip())
        and medical_profile.age is not None
        and bool((medical_profile.gender or "").strip())
        and bool((medical_profile.blood_group or "").strip())
        and medical_profile.blood_group != "UNKNOWN"
    )

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.profile.role
        token["profile_completed"] = user.profile.profile_completed
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        role = self.user.profile.role
        is_complete = role == "admin"
        if role == "doctor":
            doctor_profile = DoctorProfile.objects.filter(user=self.user).first()
            is_complete = bool(doctor_profile and is_doctor_profile_complete(doctor_profile))
        elif role == "patient":
            medical_profile, _ = PatientMedicalProfile.objects.get_or_create(user=self.user)
            is_complete = is_patient_profile_complete(self.user, medical_profile)

        if self.user.profile.profile_completed != is_complete:
            self.user.profile.profile_completed = is_complete
            self.user.profile.save(update_fields=["profile_completed"])

        data["role"] = self.user.profile.role
        data["username"] = self.user.username
        data["profile_completed"] = is_complete
        return data


class DoctorProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    first_name = serializers.CharField(source="user.first_name", required=False, allow_blank=True)
    last_name = serializers.CharField(source="user.last_name", required=False, allow_blank=True)
    email = serializers.EmailField(source="user.email", required=False, allow_blank=True)
    doctor_id = serializers.IntegerField(source="id", read_only=True)

    class Meta:
        model = DoctorProfile
        fields = [
            "doctor_id",
            "username",
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
    doctor_name = serializers.CharField(source="doctor.user.username", read_only=True)
    doctor_speciality = serializers.CharField(source="doctor.speciality", read_only=True)
    patient_name = serializers.CharField(source="patient.username", read_only=True)
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
        if not slot.is_available:
            raise serializers.ValidationError({"slot_id": "Slot is not available."})
        if not slot.doctor.is_active:
            raise serializers.ValidationError({"slot_id": "Doctor is not active."})

        slot.is_available = False
        slot.save(update_fields=["is_available"])

        return Appointment.objects.create(
            patient=patient,
            doctor=slot.doctor,
            slot=slot,
            status="pending",
            reason=validated_data.get("reason", ""),
        )
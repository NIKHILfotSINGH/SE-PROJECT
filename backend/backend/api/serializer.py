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
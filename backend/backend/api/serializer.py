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
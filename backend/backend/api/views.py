from datetime import date, timedelta

from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Q
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

class PatientMedicalProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = PatientMedicalProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsPatient]

    def get_object(self):
        obj, _ = PatientMedicalProfile.objects.get_or_create(user=self.request.user)
        return obj

    def perform_update(self, serializer):
        profile = serializer.save()
        user_profile = self.request.user.profile
        user_profile.profile_completed = is_patient_profile_complete(self.request.user, profile)
        user_profile.save(update_fields=["profile_completed"])


class DoctorSelfProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = DoctorProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsDoctor]

    def get_object(self):
        return DoctorProfile.objects.select_related("user").get(user=self.request.user)

    def perform_update(self, serializer):
        profile = serializer.save()
        user_profile = self.request.user.profile
        user_profile.profile_completed = is_doctor_profile_complete(profile)
        user_profile.save(update_fields=["profile_completed"])

class PatientProfileView(PatientMedicalProfileView):
    pass


class DoctorProfileView(DoctorSelfProfileView):
    pass


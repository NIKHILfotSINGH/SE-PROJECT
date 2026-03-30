from django.db import models
from django.contrib.auth.models import User


class UserProfile(models.Model):
    ROLE_CHOICES = (
        ("patient", "Patient"),
        ("doctor", "Doctor"),
        ("admin", "Admin"),
    )
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="patient")

    def __str__(self):
        return f"{self.user.username} ({self.role})"

class DoctorProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="doctor_profile")
    speciality = models.CharField(max_length=120)
    experience_years = models.PositiveIntegerField(default=0)
    age = models.PositiveIntegerField(null=True, blank=True)
    qualification = models.CharField(max_length=255, blank=True)
    bio = models.TextField(blank=True)
    profile_picture = models.URLField(blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"Dr. {self.user.username} - {self.speciality}"


class PatientMedicalProfile(models.Model):
    BLOOD_GROUP_CHOICES = (
        ("A+", "A+"),
        ("A-", "A-"),
        ("B+", "B+"),
        ("B-", "B-"),
        ("AB+", "AB+"),
        ("AB-", "AB-"),
        ("O+", "O+"),
        ("O-", "O-"),
        ("UNKNOWN", "Unknown"),
    )

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="medical_profile")
    mobile = models.CharField(max_length=20, blank=True)
    age = models.PositiveIntegerField(null=True, blank=True)
    gender = models.CharField(max_length=20, blank=True)
    profile_picture = models.URLField(blank=True)
    height_cm = models.PositiveIntegerField(null=True, blank=True)
    weight_kg = models.PositiveIntegerField(null=True, blank=True)
    disability_notes = models.TextField(blank=True, null=True)
    blood_group = models.CharField(max_length=10, choices=BLOOD_GROUP_CHOICES, default="UNKNOWN")
    previous_diagnosis = models.TextField(blank=True)
    allergies = models.TextField(blank=True, default="NA")
    chronic_conditions = models.TextField(blank=True, default="NA")
    current_medications = models.TextField(blank=True, default="NA")
    major_past_surgeries = models.TextField(blank=True, default="NA")

    def __str__(self):
        return f"Medical Profile - {self.user.username}"

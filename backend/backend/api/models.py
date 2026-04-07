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
    profile_completed = models.BooleanField(default=False)

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

class DoctorSlot(models.Model):
    doctor = models.ForeignKey(DoctorProfile, on_delete=models.CASCADE, related_name="slots")
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_available = models.BooleanField(default=True)

    class Meta:
        ordering = ["date", "start_time"]
        constraints = [
            models.UniqueConstraint(
                fields=["doctor", "date", "start_time", "end_time"],
                name="unique_doctor_slot_window",
            )
        ]

    def __str__(self):
        return f"{self.doctor.user.username} - {self.date} {self.start_time}-{self.end_time}"


class DoctorWeeklyAvailability(models.Model):
    WEEKDAY_CHOICES = (
        (0, "Monday"),
        (1, "Tuesday"),
        (2, "Wednesday"),
        (3, "Thursday"),
        (4, "Friday"),
        (5, "Saturday"),
        (6, "Sunday"),
    )

    doctor = models.ForeignKey(DoctorProfile, on_delete=models.CASCADE, related_name="weekly_availability")
    weekday = models.PositiveSmallIntegerField(choices=WEEKDAY_CHOICES)
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["weekday", "start_time"]
        constraints = [
            models.UniqueConstraint(
                fields=["doctor", "weekday", "start_time", "end_time"],
                name="unique_weekly_schedule_window",
            )
        ]

    def __str__(self):
        return f"{self.doctor.user.username} - {self.get_weekday_display()} {self.start_time}-{self.end_time}"


class Appointment(models.Model):
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("confirmed", "Confirmed"),
        ("cancelled", "Cancelled"),
        ("completed", "Completed"),
    )

    patient = models.ForeignKey(User, on_delete=models.CASCADE, related_name="patient_appointments")
    doctor = models.ForeignKey(DoctorProfile, on_delete=models.CASCADE, related_name="doctor_appointments")
    slot = models.OneToOneField(DoctorSlot, on_delete=models.CASCADE, related_name="appointment")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    reason = models.TextField(blank=True)
    is_hidden_for_patient = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Appointment #{self.id} - {self.patient.username} with {self.doctor.user.username}"


class ConsultationReport(models.Model):
    appointment = models.OneToOneField(Appointment, on_delete=models.CASCADE, related_name="report")
    doctor = models.ForeignKey(DoctorProfile, on_delete=models.CASCADE, related_name="reports")
    diagnosis = models.TextField()
    prescription = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Report for appointment #{self.appointment_id}"

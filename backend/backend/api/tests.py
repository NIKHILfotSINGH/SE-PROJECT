from datetime import date, time

from django.contrib.auth.models import User
from django.test import TestCase

from .models import Appointment, DoctorProfile, DoctorSlot
from .serializer import AppointmentSerializer, DoctorProfileSerializer


class DoctorDisplayNameSerializerTests(TestCase):
	def test_doctor_profile_serializer_uses_full_name_as_display_name(self):
		user = User.objects.create_user(
			username="doctor.username@example.com",
			password="test-pass-123",
			first_name="Aman",
			last_name="Raj",
		)
		profile = DoctorProfile.objects.create(
			user=user,
			speciality="General",
			experience_years=3,
			age=28,
			qualification="MBBS",
		)

		data = DoctorProfileSerializer(profile).data
		self.assertEqual(data["display_name"], "Aman Raj")

	def test_doctor_profile_serializer_falls_back_to_username(self):
		user = User.objects.create_user(
			username="doctor.username@example.com",
			password="test-pass-123",
		)
		profile = DoctorProfile.objects.create(
			user=user,
			speciality="General",
			experience_years=3,
			age=28,
			qualification="MBBS",
		)

		data = DoctorProfileSerializer(profile).data
		self.assertEqual(data["display_name"], "doctor.username@example.com")


class AppointmentDisplayNameSerializerTests(TestCase):
	def test_appointment_serializer_uses_real_names_not_usernames(self):
		patient = User.objects.create_user(
			username="patient.email@example.com",
			password="test-pass-123",
			first_name="Nikhil",
			last_name="Singh",
		)
		doctor_user = User.objects.create_user(
			username="doctor.email@example.com",
			password="test-pass-123",
			first_name="Aman",
			last_name="Raj",
		)
		doctor = DoctorProfile.objects.create(
			user=doctor_user,
			speciality="General",
			experience_years=5,
			age=32,
			qualification="MBBS",
		)
		slot = DoctorSlot.objects.create(
			doctor=doctor,
			date=date.today(),
			start_time=time(13, 0),
			end_time=time(16, 0),
			is_available=True,
		)
		appointment = Appointment.objects.create(
			patient=patient,
			doctor=doctor,
			slot=slot,
			status="pending",
			reason="Fever",
		)

		data = AppointmentSerializer(appointment).data
		self.assertEqual(data["doctor_name"], "Aman Raj")
		self.assertEqual(data["patient_name"], "Nikhil Singh")

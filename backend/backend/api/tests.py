from django.test import TestCase
from django.contrib.auth.models import User

from .models import DoctorProfile, PatientMedicalProfile
from .serializer import (
    DoctorProfileSerializer,
    PatientMedicalProfileSerializer,
    is_patient_profile_complete,
)


class PatientMedicalProfileSerializerTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="patient_mobile_test",
            password="test-pass-123",
            first_name="John",
            last_name="Doe",
        )
        self.profile = PatientMedicalProfile.objects.create(
            user=self.user,
            mobile="9876543210",
            age=25,
            gender="male",
            blood_group="O+",
        )

    def test_rejects_mobile_with_wrong_length(self):
        serializer = PatientMedicalProfileSerializer(
            instance=self.profile,
            data={"mobile": "12345"},
            partial=True,
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("mobile", serializer.errors)

    def test_accepts_mobile_with_formatting_and_normalizes(self):
        serializer = PatientMedicalProfileSerializer(
            instance=self.profile,
            data={"mobile": "(987) 654-3210"},
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data["mobile"], "9876543210")

    def test_profile_completion_is_false_for_invalid_mobile(self):
        self.profile.mobile = "123"

        self.assertFalse(is_patient_profile_complete(self.user, self.profile))


class DoctorProfileSerializerTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="doctor_profile_test",
            password="test-pass-123",
        )
        self.profile = DoctorProfile.objects.create(
            user=self.user,
            speciality="General",
            qualification="MBBS",
            age=30,
            experience_years=5,
        )

    def test_rejects_experience_greater_than_age(self):
        serializer = DoctorProfileSerializer(
            instance=self.profile,
            data={"age": 30, "experience_years": 60},
            partial=True,
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("experience_years", serializer.errors)

    def test_rejects_unrealistic_experience_for_young_age(self):
        serializer = DoctorProfileSerializer(
            instance=self.profile,
            data={"age": 20, "experience_years": 10},
            partial=True,
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("experience_years", serializer.errors)

    def test_accepts_reasonable_age_experience_combination(self):
        serializer = DoctorProfileSerializer(
            instance=self.profile,
            data={"age": 35, "experience_years": 10},
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)

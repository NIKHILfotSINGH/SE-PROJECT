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

class DoctorSlotListCreateView(generics.ListCreateAPIView):
    serializer_class = DoctorSlotSerializer
    permission_classes = [permissions.IsAuthenticated, IsDoctor, IsProfileCompleted]

    def get_queryset(self):
        return DoctorSlot.objects.filter(doctor__user=self.request.user)

    def create(self, request, *args, **kwargs):
        return Response(
            {
                "detail": (
                    "Manual slot creation is disabled. Configure weekly availability with fixed "
                    "shifts (morning/evening/night)."
                )
            },
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def perform_create(self, serializer):
        doctor = DoctorProfile.objects.get(user=self.request.user)
        serializer.save(doctor=doctor)


class DoctorSlotUpdateView(generics.UpdateAPIView):
    serializer_class = DoctorSlotSerializer
    permission_classes = [permissions.IsAuthenticated, IsDoctor, IsProfileCompleted]
    queryset = DoctorSlot.objects.all()

    def get_queryset(self):
        return DoctorSlot.objects.filter(doctor__user=self.request.user)

class AppointmentListView(generics.ListAPIView):
    serializer_class = AppointmentSerializer
    permission_classes = [permissions.IsAuthenticated, IsProfileCompleted]

    def get_queryset(self):
        user = self.request.user
        role = user.profile.role
        base_qs = Appointment.objects.select_related("patient", "doctor", "doctor__user", "slot")
        time_range = self.request.query_params.get("time_range", "").strip().lower()
        if role == "patient":
            return apply_appointment_time_range_filter(
                base_qs.filter(patient=user, is_hidden_for_patient=False),
                time_range,
            )
        if role == "doctor":
            return apply_appointment_time_range_filter(base_qs.filter(doctor__user=user), time_range)
        return apply_appointment_time_range_filter(base_qs, time_range)


class AppointmentMineView(AppointmentListView):
    pass


class AppointmentListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated, IsProfileCompleted]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return BookAppointmentSerializer
        return AppointmentSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [permissions.IsAuthenticated(), IsPatient(), IsProfileCompleted()]
        return [permissions.IsAuthenticated(), IsProfileCompleted()]

    def get_queryset(self):
        user = self.request.user
        role = user.profile.role
        base_qs = Appointment.objects.select_related("patient", "doctor", "doctor__user", "slot")
        time_range = self.request.query_params.get("time_range", "").strip().lower()
        if role == "patient":
            return apply_appointment_time_range_filter(
                base_qs.filter(patient=user, is_hidden_for_patient=False),
                time_range,
            )
        if role == "doctor":
            return apply_appointment_time_range_filter(base_qs.filter(doctor__user=user), time_range)
        return apply_appointment_time_range_filter(base_qs, time_range)


class AppointmentBookView(generics.CreateAPIView):
    serializer_class = BookAppointmentSerializer
    permission_classes = [permissions.IsAuthenticated, IsPatient, IsProfileCompleted]


class AppointmentCancelView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsProfileCompleted]

    @transaction.atomic
    def patch(self, request, appointment_id):
        appointment = Appointment.objects.select_related("patient", "doctor", "doctor__user", "slot").filter(
            id=appointment_id
        ).first()
        if not appointment:
            return Response({"detail": "Appointment not found."}, status=404)

        role = request.user.profile.role
        allowed = (
            (role == "patient" and appointment.patient_id == request.user.id)
            or (role == "doctor" and appointment.doctor.user_id == request.user.id)
            or role == "admin"
        )
        if not allowed:
            return Response({"detail": "Not allowed to cancel this appointment."}, status=403)

        if appointment.status in ["cancelled", "completed"]:
            return Response({"detail": f"Cannot cancel an appointment that is already {appointment.status}."}, status=400)

        if appointment.slot.date < date.today():
            return Response({"detail": "Cannot cancel a past appointment."}, status=400)

        appointment.status = "cancelled"
        appointment.save(update_fields=["status", "updated_at"])
        appointment.slot.is_available = True
        appointment.slot.save(update_fields=["is_available"])
        return Response({"detail": "Appointment cancelled."})

class AppointmentUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsProfileCompleted]

    @transaction.atomic
    def patch(self, request, appointment_id):
        appointment = Appointment.objects.select_related("patient", "doctor", "doctor__user", "slot").filter(
            id=appointment_id
        ).first()
        if not appointment:
            return Response({"detail": "Appointment not found."}, status=404)

        role = request.user.profile.role
        allowed = (
            (role == "patient" and appointment.patient_id == request.user.id)
            or (role == "doctor" and appointment.doctor.user_id == request.user.id)
            or role == "admin"
        )
        if not allowed:
            return Response({"detail": "Not allowed to update this appointment."}, status=403)

        serializer = AppointmentStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        status_value = serializer.validated_data["status"]
        appointment.status = status_value
        appointment.save(update_fields=["status", "updated_at"])

        if status_value == "cancelled":
            appointment.slot.is_available = True
            appointment.slot.save(update_fields=["is_available"])

        return Response(AppointmentSerializer(appointment).data)
class AppointmentRescheduleView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsProfileCompleted]

    @transaction.atomic
    def patch(self, request, appointment_id):
        appointment = Appointment.objects.select_related("patient", "doctor", "doctor__user", "slot").filter(
            id=appointment_id
        ).first()
        if not appointment:
            return Response({"detail": "Appointment not found."}, status=404)

        role = request.user.profile.role
        allowed = (
            (role == "patient" and appointment.patient_id == request.user.id)
            or (role == "doctor" and appointment.doctor.user_id == request.user.id)
            or role == "admin"
        )
        if not allowed:
            return Response({"detail": "Not allowed to reschedule this appointment."}, status=403)

        if appointment.status in ["cancelled", "completed"]:
            return Response({"detail": f"Cannot reschedule an appointment that is already {appointment.status}."}, status=400)

        if appointment.slot.date < date.today():
            return Response({"detail": "Cannot reschedule a past appointment."}, status=400)

        serializer = RescheduleAppointmentSerializer(instance=appointment, data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()
        return Response(AppointmentSerializer(updated).data)
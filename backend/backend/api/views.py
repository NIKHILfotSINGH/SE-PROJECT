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

def apply_appointment_time_range_filter(queryset, time_range):
    if time_range == "today":
        return queryset.filter(slot__date=date.today())

    if time_range == "week":
        today = date.today()
        week_start = today - timedelta(days=today.weekday())
        week_end = week_start + timedelta(days=6)
        return queryset.filter(slot__date__gte=week_start, slot__date__lte=week_end)

    if time_range == "month":
        today = date.today()
        month_start = today.replace(day=1)
        if month_start.month == 12:
            next_month_start = month_start.replace(year=month_start.year + 1, month=1)
        else:
            next_month_start = month_start.replace(month=month_start.month + 1)
        return queryset.filter(slot__date__gte=month_start, slot__date__lt=next_month_start)

    return queryset

class DoctorListView(generics.ListAPIView):
    serializer_class = DoctorProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsProfileCompleted]

    def get_queryset(self):
        queryset = DoctorProfile.objects.select_related("user").filter(is_active=True)
        q = self.request.query_params.get("q", "").strip() or self.request.query_params.get("search", "").strip()
        speciality = self.request.query_params.get("speciality", "").strip()
        if q:
            queryset = queryset.filter(Q(user__username__icontains=q) | Q(speciality__icontains=q))
        if speciality:
            queryset = queryset.filter(speciality__icontains=speciality)
        return queryset

class AdminDoctorCreateView(generics.CreateAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    serializer_class = AdminDoctorCreateSerializer

class AdminDoctorRemoveView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    @transaction.atomic
    def post(self, request, doctor_id):
        replacement_id = request.data.get("replacement_doctor_id")
        if not replacement_id:
            return Response(
                {"detail": "replacement_doctor_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        doctor = DoctorProfile.objects.filter(id=doctor_id, is_active=True).select_related("user").first()
        replacement = DoctorProfile.objects.filter(id=replacement_id, is_active=True).first()
        if not doctor or not replacement:
            return Response({"detail": "Doctor or replacement doctor not found."}, status=404)
        if doctor.id == replacement.id:
            return Response({"detail": "Replacement doctor must be different."}, status=400)

        future_appointments = Appointment.objects.filter(
            doctor=doctor,
            slot__date__gte=date.today(),
            status__in=["pending", "confirmed"],
        ).select_related("slot")

        for appointment in future_appointments:
            # Try to find matching time slot with replacement doctor.
            replacement_slot = DoctorSlot.objects.filter(
                doctor=replacement,
                date=appointment.slot.date,
                start_time=appointment.slot.start_time,
                end_time=appointment.slot.end_time,
                is_available=True,
            ).first()
            if not replacement_slot:
                continue
            appointment.slot.is_available = True
            appointment.slot.save(update_fields=["is_available"])

            replacement_slot.is_available = False
            replacement_slot.save(update_fields=["is_available"])

            appointment.doctor = replacement
            appointment.slot = replacement_slot
            appointment.save(update_fields=["doctor", "slot", "updated_at"])

        doctor.is_active = False
        doctor.save(update_fields=["is_active"])

        return Response({"detail": "Doctor removed and future appointments reassigned where slots matched."})

class AdminUserListView(generics.ListAPIView):
    serializer_class = AdminUserListSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get_queryset(self):
        queryset = User.objects.select_related("profile", "doctor_profile", "medical_profile").filter(
            profile__role__in=["doctor", "patient"]
        )

        role = self.request.query_params.get("role", "").strip().lower()
        if role in {"doctor", "patient"}:
            queryset = queryset.filter(profile__role=role)

        status_filter = self.request.query_params.get("status", "").strip().lower()
        if status_filter == "active":
            queryset = queryset.filter(is_active=True)
        elif status_filter == "inactive":
            queryset = queryset.filter(is_active=False)

        search_query = self.request.query_params.get("q", "").strip() or self.request.query_params.get("search", "").strip()
        if search_query:
            queryset = queryset.filter(
                Q(username__icontains=search_query)
                | Q(first_name__icontains=search_query)
                | Q(last_name__icontains=search_query)
                | Q(email__icontains=search_query)
                | Q(doctor_profile__speciality__icontains=search_query)
            )

        return queryset.order_by("username")

class AdminUserDetailView(generics.RetrieveAPIView):
    serializer_class = AdminUserDetailSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    lookup_url_kwarg = "user_id"

    def get_queryset(self):
        return User.objects.select_related("profile", "doctor_profile", "medical_profile").filter(
            profile__role__in=["doctor", "patient"]
        )
class AdminUserStatusUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    @transaction.atomic
    def patch(self, request, user_id):
        target_user = User.objects.select_related("profile", "doctor_profile").filter(
            id=user_id,
            profile__role__in=["doctor", "patient"],
        ).first()
        if not target_user:
            return Response({"detail": "User not found."}, status=404)

        serializer = AdminUserStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        next_status = serializer.validated_data["is_active"]
        role = target_user.profile.role
        cancelled_appointments = 0

        if role == "doctor":
            doctor_profile = DoctorProfile.objects.filter(user=target_user).first()
            if doctor_profile:
                if not next_status and doctor_profile.is_active:
                    upcoming_appointments = list(
                        Appointment.objects.select_related("slot").filter(
                            doctor=doctor_profile,
                            status__in=["pending", "confirmed"],
                            slot__date__gte=date.today(),
                        )
                    )
                    cancelled_appointments = len(upcoming_appointments)
                    for appointment in upcoming_appointments:
                        appointment.status = "cancelled"
                        appointment.save(update_fields=["status", "updated_at"])

                        appointment.slot.is_available = True
                        appointment.slot.save(update_fields=["is_available"])

                doctor_profile.is_active = next_status
                doctor_profile.save(update_fields=["is_active"])

        target_user.is_active = next_status
        target_user.save(update_fields=["is_active"])

        action_label = "activated" if next_status else "deactivated"
        return Response(
            {
                "detail": f"User {action_label} successfully.",
                "cancelled_appointments": cancelled_appointments,
                "user": AdminUserListSerializer(target_user).data,
            }
        )

class DoctorWeeklyAvailabilityListCreateView(generics.ListCreateAPIView):
    serializer_class = DoctorWeeklyAvailabilitySerializer
    permission_classes = [permissions.IsAuthenticated, IsDoctor, IsProfileCompleted]

    def get_queryset(self):
        return DoctorWeeklyAvailability.objects.filter(doctor__user=self.request.user)

    def _generate_slots_from_weekly(self, doctor, weekly_items, days=30):
        for offset in range(days):
            slot_date = date.today() + timedelta(days=offset)
            weekday = slot_date.weekday()
            for weekly in weekly_items:
                if weekly.weekday != weekday:
                    continue
                DoctorSlot.objects.get_or_create(
                    doctor=doctor,
                    date=slot_date,
                    start_time=weekly.start_time,
                    end_time=weekly.end_time,
                    defaults={"is_available": True},
                )

    def perform_create(self, serializer):
        doctor = DoctorProfile.objects.get(user=self.request.user)
        weekly_item = serializer.save(doctor=doctor)
        if weekly_item.is_active:
            self._generate_slots_from_weekly(doctor, [weekly_item])


class DoctorWeeklyAvailabilityUpdateView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = DoctorWeeklyAvailabilitySerializer
    permission_classes = [permissions.IsAuthenticated, IsDoctor, IsProfileCompleted]

    def _generate_slots_from_weekly(self, doctor, weekly_items, days=30):
        for offset in range(days):
            slot_date = date.today() + timedelta(days=offset)
            weekday = slot_date.weekday()
            for weekly in weekly_items:
                if weekly.weekday != weekday:
                    continue
                DoctorSlot.objects.get_or_create(
                    doctor=doctor,
                    date=slot_date,
                    start_time=weekly.start_time,
                    end_time=weekly.end_time,
                    defaults={"is_available": True},
                )

    def perform_update(self, serializer):
        weekly_item = serializer.save()
        if weekly_item.is_active:
            self._generate_slots_from_weekly(weekly_item.doctor, [weekly_item])

    def get_queryset(self):
        return DoctorWeeklyAvailability.objects.filter(doctor__user=self.request.user)


class DoctorPublicSlotListView(generics.ListAPIView):
    serializer_class = DoctorSlotSerializer
    permission_classes = [permissions.IsAuthenticated, IsProfileCompleted]

    def get_queryset(self):
        doctor_id = self.kwargs["doctor_id"]
        return DoctorSlot.objects.filter(
            doctor_id=doctor_id,
            doctor__is_active=True,
            is_available=True,
            date__gte=date.today(),
        )

class SlotListByDoctorView(generics.ListAPIView):
    serializer_class = DoctorSlotSerializer
    permission_classes = [permissions.IsAuthenticated, IsProfileCompleted]

    def get_queryset(self):
        doctor_id = self.request.query_params.get("doctor_id")
        if not doctor_id:
            return DoctorSlot.objects.none()
        return DoctorSlot.objects.filter(
            doctor_id=doctor_id,
            doctor__is_active=True,
            is_available=True,
            date__gte=date.today(),
        )

class PatientHistoryForDoctorAdminView(generics.ListAPIView):
    serializer_class = AppointmentSerializer
    permission_classes = [permissions.IsAuthenticated, IsDoctorOrAdmin, IsProfileCompleted]

    def get_queryset(self):
        patient_id = self.kwargs["patient_id"]
        qs = Appointment.objects.select_related("patient", "doctor", "doctor__user", "slot").filter(patient_id=patient_id)
        if self.request.user.profile.role == "doctor":
            return qs.filter(doctor__user=self.request.user)
        return qs


class DoctorHistoryForAdminView(generics.ListAPIView):
    serializer_class = AppointmentSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get_queryset(self):
        doctor_id = self.kwargs["doctor_id"]
        return Appointment.objects.select_related("patient", "doctor", "doctor__user", "slot").filter(doctor_id=doctor_id)

class AppointmentReportView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsProfileCompleted]

    def get(self, request, appointment_id):
        appointment = Appointment.objects.select_related("patient", "doctor", "doctor__user").filter(
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
            return Response({"detail": "Not allowed."}, status=403)

        report = ConsultationReport.objects.filter(appointment=appointment).select_related("doctor", "doctor__user").first()
        if not report:
            return Response({"detail": "No report yet."}, status=404)
        return Response(ConsultationReportSerializer(report).data)

    @transaction.atomic
    def post(self, request, appointment_id):
        if request.user.profile.role != "doctor":
            return Response({"detail": "Only doctors can create reports."}, status=403)

        appointment = Appointment.objects.select_related("doctor", "doctor__user").filter(id=appointment_id).first()
        if not appointment or appointment.doctor.user_id != request.user.id:
            return Response({"detail": "Appointment not found for this doctor."}, status=404)

        doctor_profile = DoctorProfile.objects.get(user=request.user)
        report, _ = ConsultationReport.objects.get_or_create(appointment=appointment, defaults={"doctor": doctor_profile, "diagnosis": ""})

        serializer = ConsultationReportSerializer(instance=report, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        diagnosis_text = (serializer.validated_data.get("diagnosis") or report.diagnosis or "").strip()
        if not diagnosis_text:
            return Response({"diagnosis": ["Diagnosis is required."]}, status=400)

        serializer.save(doctor=doctor_profile, appointment=appointment, diagnosis=diagnosis_text)

        patient_profile, _ = PatientMedicalProfile.objects.get_or_create(user=appointment.patient)
        patient_profile.previous_diagnosis = diagnosis_text
        patient_profile.save(update_fields=["previous_diagnosis"])

        appointment.status = "completed"
        appointment.save(update_fields=["status", "updated_at"])
        return Response(serializer.data)
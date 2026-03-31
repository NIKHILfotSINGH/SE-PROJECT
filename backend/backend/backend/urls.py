
from django.contrib import admin
from django.urls import path
from api.views import (
    RegisterView,
    CustomTokenObtainPairView
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path("api/auth/register/", RegisterView.as_view(), name="register"),
    path("api/auth/login/", CustomTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/doctor/profile/", DoctorSelfProfileView.as_view(), name="doctor_self_profile"),
    path("api/patient/medical-profile/", PatientMedicalProfileView.as_view(), name="patient_medical_profile"),
    path("api/patients/profile/", PatientProfileView.as_view(), name="patients_profile"),
    path("api/doctors/profile/", DoctorProfileView.as_view(), name="doctors_profile")
]

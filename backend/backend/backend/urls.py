
from django.contrib import admin
from django.urls import path
from api.views import (
    RegisterView,
    CustomTokenObtainPairView
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path("api/auth/register/", RegisterView.as_view(), name="register"),
    path("api/auth/login/", CustomTokenObtainPairView.as_view(), name="token_obtain_pair")
]

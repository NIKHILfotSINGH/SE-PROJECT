from rest_framework.permissions import BasePermission


class RolePermission(BasePermission):
    allowed_roles = None

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if self.allowed_roles is None:
            return True
        return getattr(request.user.profile, "role", None) in self.allowed_roles


class IsPatient(RolePermission):
    allowed_roles = {"patient"}


class IsDoctor(RolePermission):
    allowed_roles = {"doctor"}


class IsAdmin(RolePermission):
    allowed_roles = {"admin"}


class IsDoctorOrAdmin(RolePermission):
    allowed_roles = {"doctor", "admin"}
from rest_framework.permissions import BasePermission

class RolePermission(BasePermission):
    allowed_roles = None  # set per view

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if self.allowed_roles is None:
            return True
        return getattr(request.user.profile, "role", None) in self.allowed_roles

class IsPatient(RolePermission):
    allowed_roles = {"patient"}

class IsDoctor(RolePermission):
    allowed_roles = {"doctor"}

class IsAdmin(RolePermission):
    allowed_roles = {"admin"}

class IsDoctorOrAdmin(RolePermission):
    allowed_roles = {"doctor", "admin"}
import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute, RoleRoute } from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import PatientLayout from "./pages/patient/PatientLayout";
import PatientSearchPage from "./pages/patient/PatientSearchPage";
import PatientAppointmentsPage from "./pages/patient/PatientAppointmentsPage";
import PatientProfilePage from "./pages/patient/PatientProfilePage";
import DoctorLayout from "./pages/doctor/DoctorLayout";
import DoctorProfilePage from "./pages/doctor/DoctorProfilePage";
import DoctorSlotsPage from "./pages/doctor/DoctorSlotsPage";
import DoctorAppointmentsPage from "./pages/doctor/DoctorAppointmentsPage";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminOverviewPage from "./pages/admin/AdminOverviewPage";
import AdminUsersPage from "./pages/admin/AdminPatientsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<RoleRoute allowed={["patient"]} />}>
          <Route path="/patient" element={<PatientLayout />}>
            <Route index element={<Navigate to="search" replace />} />
            <Route path="search" element={<PatientSearchPage />} />
            <Route path="appointments" element={<PatientAppointmentsPage />} />
            <Route path="profile" element={<PatientProfilePage />} />
          </Route>
        </Route>
        <Route element={<RoleRoute allowed={["doctor"]} />}>
          <Route path="/doctor" element={<DoctorLayout />}>
            <Route index element={<Navigate to="appointments" replace />} />
            <Route path="appointments" element={<DoctorAppointmentsPage />} />
            <Route path="slots" element={<DoctorSlotsPage />} />
            <Route path="profile" element={<DoctorProfilePage />} />
          </Route>
        </Route>
        <Route element={<RoleRoute allowed={["admin"]} />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<AdminOverviewPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="doctors" element={<Navigate to="/admin/users" replace />} />
            <Route path="patients" element={<Navigate to="/admin/users" replace />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
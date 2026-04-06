import api from "../auth/api";

export async function getDoctors(params = {}) {
  const { data } = await api.get("/api/doctors/", { params });
  return data;
}

export async function getDoctorSlots(doctorId) {
  const { data } = await api.get(`/api/doctors/${doctorId}/slots/`);
  return data;
}

export async function getAppointments(params = {}) {
  const { data } = await api.get("/api/appointments/", { params });
  return data;
}

export async function bookAppointment(payload) {
  const { data } = await api.post("/api/appointments/book/", payload);
  return data;
}

export async function cancelAppointment(appointmentId) {
  const { data } = await api.patch(`/api/appointments/${appointmentId}/cancel/`);
  return data;
}

export async function hideAppointmentForPatient(appointmentId) {
  const { data } = await api.patch(`/api/appointments/${appointmentId}/hide/`);
  return data;
}

export async function rescheduleAppointment(appointmentId, slotId) {
  const { data } = await api.patch(`/api/appointments/${appointmentId}/reschedule/`, {
    slot_id: Number(slotId),
  });
  return data;
}

export async function getPatientMedicalProfile() {
  const { data } = await api.get("/api/patient/medical-profile/");
  return data;
}

export async function getPatientMedicalProfileById(patientId) {
  const { data } = await api.get(`/api/patients/${patientId}/medical-profile/`);
  return data;
}

export async function updatePatientMedicalProfile(payload) {
  const { data } = await api.patch("/api/patient/medical-profile/", payload);
  return data;
}

export async function getDoctorProfile() {
  const { data } = await api.get("/api/doctor/profile/");
  return data;
}

export async function updateDoctorProfile(payload) {
  const { data } = await api.patch("/api/doctor/profile/", payload);
  return data;
}

export async function getDoctorOwnSlots() {
  const { data } = await api.get("/api/doctor/slots/");
  return data;
}

export async function getDoctorWeeklyAvailability() {
  const { data } = await api.get("/api/doctor/weekly-availability/");
  return data;
}

export async function createDoctorWeeklyAvailability(payload) {
  const { data } = await api.post("/api/doctor/weekly-availability/", payload);
  return data;
}

export async function updateDoctorWeeklyAvailability(availabilityId, payload) {
  const { data } = await api.patch(`/api/doctor/weekly-availability/${availabilityId}/`, payload);
  return data;
}

export async function updateDoctorSlot(slotId, payload) {
  const { data } = await api.patch(`/api/doctor/slots/${slotId}/`, payload);
  return data;
}

export async function upsertAppointmentReport(appointmentId, payload) {
  const { data } = await api.post(`/api/appointments/${appointmentId}/report/`, payload);
  return data;
}

export async function removeDoctorByAdmin(doctorId, replacementDoctorId) {
  const { data } = await api.post(`/api/admin/doctors/${doctorId}/remove/`, {
    replacement_doctor_id: Number(replacementDoctorId),
  });
  return data;
}

export async function getDoctorHistoryByAdmin(doctorId) {
  const { data } = await api.get(`/api/admin/doctors/${doctorId}/history/`);
  return data;
}

export async function getAdminDashboardSummary(params = {}) {
  const { data } = await api.get("/api/admin/dashboard-summary/", { params });
  return data;
}

export async function getAdminUsers(params = {}) {
  const { data } = await api.get("/api/admin/users/", { params });
  return data;
}

export async function getAdminUserProfile(userId) {
  const { data } = await api.get(`/api/admin/users/${userId}/profile/`);
  return data;
}

export async function setAdminUserStatus(userId, isActive) {
  const { data } = await api.patch(`/api/admin/users/${userId}/status/`, {
    is_active: Boolean(isActive),
  });
  return data;
}

export function getApiErrorMessage(error, fallback = "Request failed") {
  const responseData = error?.response?.data;
  if (typeof responseData === "string" && responseData.trim()) {
    return responseData;
  }
  if (responseData?.detail) {
    return responseData.detail;
  }
  if (responseData && typeof responseData === "object") {
    const firstKey = Object.keys(responseData)[0];
    const firstValue = responseData[firstKey];
    if (Array.isArray(firstValue) && firstValue.length) {
      return String(firstValue[0]);
    }
    if (typeof firstValue === "string" && firstValue.trim()) {
      return firstValue;
    }
  }
  if (error?.message) {
    return error.message;
  }
  return fallback;
}
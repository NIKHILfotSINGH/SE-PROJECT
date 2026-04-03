import api from "../auth/api";

export async function getDoctors(params = {}) {
  const { data } = await api.get("/api/doctors/", { params });
  return data;
}
export async function getPatientMedicalProfile() {
  const { data } = await api.get("/api/patient/medical-profile/");
  return data;
}
export async function getDoctorProfile() {
  const { data } = await api.get("/api/doctor/profile/");
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
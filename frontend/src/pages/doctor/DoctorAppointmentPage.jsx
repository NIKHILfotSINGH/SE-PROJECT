import React from "react";
import {
  cancelAppointment,
  getApiErrorMessage,
  getAppointments,
  getDoctorOwnSlots,
  getPatientMedicalProfileById,
  rescheduleAppointment,
  upsertAppointmentReport,
} from "../../services/hospitalApi";

const CURRENT_STATUSES = new Set(["pending", "confirmed"]);
const PAST_STATUSES = new Set(["completed", "cancelled"]);

function initialReportState(appointment) {
  return {
    diagnosis: "",
    appointmentId: appointment.id,
  };
}

export default function DoctorAppointmentsPage() {
  const [appointments, setAppointments] = React.useState([]);
  const [slots, setSlots] = React.useState([]);
  const [rescheduleMap, setRescheduleMap] = React.useState({});
  const [openRescheduleId, setOpenRescheduleId] = React.useState(null);
  const [reportMap, setReportMap] = React.useState({});
  const [savingReports, setSavingReports] = React.useState({});
  const [activeTab, setActiveTab] = React.useState("current");
  const [timeRange, setTimeRange] = React.useState("all");
  const [patientProfileModal, setPatientProfileModal] = React.useState({
    open: false,
    loading: false,
    error: "",
    appointmentId: null,
    patientName: "",
    data: null,
  });
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");

  async function loadBase(range = timeRange) {
    const params = range === "all" ? {} : { time_range: range };
    const [appointmentData, slotData] = await Promise.all([getAppointments(params), getDoctorOwnSlots()]);
    setAppointments(appointmentData);
    setSlots(slotData);
  }

  React.useEffect(() => {
    loadBase(timeRange).catch((err) => setError(getApiErrorMessage(err, "Failed to load appointments")));
  }, [timeRange]);

  async function handleCancel(appointmentId) {
    setError("");
    setMessage("");
    try {
      await cancelAppointment(appointmentId);
      if (openRescheduleId === appointmentId) {
        setOpenRescheduleId(null);
      }
      await loadBase();
      setMessage("Appointment cancelled.");
    } catch (err) {
      setError(getApiErrorMessage(err, "Cancel failed"));
    }
  }

  async function handleReschedule(appointmentId) {
    const slotId = rescheduleMap[appointmentId];
    if (!slotId) return;
    setError("");
    setMessage("");
    try {
      await rescheduleAppointment(appointmentId, slotId);
      setOpenRescheduleId(null);
      await loadBase();
      setMessage("Appointment rescheduled.");
    } catch (err) {
      setError(getApiErrorMessage(err, "Reschedule failed"));
    }
  }

  async function handleSaveReport(appointment) {
    const draft = reportMap[appointment.id] || initialReportState(appointment);
    if (!draft.diagnosis.trim()) {
      setError("Diagnosis is required before saving report.");
      setMessage("");
      return;
    }

    setError("");
    setMessage("");
    setSavingReports((prev) => ({ ...prev, [appointment.id]: true }));
    try {
      await upsertAppointmentReport(appointment.id, {
        diagnosis: draft.diagnosis.trim(),
      });
      setReportMap((prev) => {
        const next = { ...prev };
        delete next[appointment.id];
        return next;
      });
      await loadBase();
      setActiveTab("past");
      setMessage("Consultation report saved and appointment moved to past.");
    } catch (err) {
      setError(getApiErrorMessage(err, "Report save failed"));
    } finally {
      setSavingReports((prev) => ({ ...prev, [appointment.id]: false }));
    }
  }

  async function handleViewPatientProfile(appointment) {
    setPatientProfileModal({
      open: true,
      loading: true,
      error: "",
      appointmentId: appointment.id,
      patientName: appointment.patient_name,
      data: null,
    });

    try {
      const data = await getPatientMedicalProfileById(appointment.patient);
      setPatientProfileModal((prev) => ({ ...prev, loading: false, data }));
    } catch (err) {
      setPatientProfileModal((prev) => ({
        ...prev,
        loading: false,
        error: getApiErrorMessage(err, "Failed to load patient profile"),
      }));
    }
  }

  function closePatientProfileModal() {
    setPatientProfileModal({
      open: false,
      loading: false,
      error: "",
      appointmentId: null,
      patientName: "",
      data: null,
    });
  }
import React from "react";
import {
  cancelAppointment,
  getApiErrorMessage,
  getAppointments,
  getDoctorSlots,
  hideAppointmentForPatient,
  rescheduleAppointment,
} from "../../services/hospitalApi";

export default function PatientAppointmentsPage() {
  const [appointments, setAppointments] = React.useState([]);
  const [slotsByDoctor, setSlotsByDoctor] = React.useState({});
  const [rescheduleMap, setRescheduleMap] = React.useState({});
  const [openRescheduleId, setOpenRescheduleId] = React.useState(null);
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  async function loadAppointmentsOnly() {
    const data = await getAppointments();
    setAppointments(data);
  }

  async function ensureDoctorSlotsLoaded(doctorId) {
    if (!doctorId || slotsByDoctor[doctorId]) {
      return;
    }
    const data = await getDoctorSlots(doctorId);
    setSlotsByDoctor((prev) => ({ ...prev, [doctorId]: data }));
  }

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await loadAppointmentsOnly();
      } catch (err) {
        setError(getApiErrorMessage(err, "Failed to load appointments"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleCancel(appointmentId) {
    setError("");
    setMessage("");
    try {
      await cancelAppointment(appointmentId);
      setMessage("Appointment cancelled.");
      setOpenRescheduleId(null);
      await loadAppointmentsOnly();
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
      setMessage("Appointment rescheduled.");
      setOpenRescheduleId(null);
      await loadAppointmentsOnly();
    } catch (err) {
      setError(getApiErrorMessage(err, "Reschedule failed"));
    }
  }

  async function handleDelete(appointmentId) {
    setError("");
    setMessage("");
    try {
      await hideAppointmentForPatient(appointmentId);
      setAppointments((prev) => prev.filter((appt) => appt.id !== appointmentId));
      if (openRescheduleId === appointmentId) {
        setOpenRescheduleId(null);
      }
      setMessage("Appointment deleted from your list.");
    } catch (err) {
      setError(getApiErrorMessage(err, "Delete failed"));
    }
  }

  async function handleToggleReschedule(appointment) {
    const isOpen = openRescheduleId === appointment.id;
    if (isOpen) {
      setOpenRescheduleId(null);
      return;
    }
    setError("");
    try {
      await ensureDoctorSlotsLoaded(appointment.doctor);
      setOpenRescheduleId(appointment.id);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load slots for rescheduling"));
    }
}
import React from "react";
import {
  cancelAppointment,
  getApiErrorMessage,
  getAppointments,
  getDoctorSlots,
  hideAppointmentForPatient,
  rescheduleAppointment,
} from "../../services/HospitalApi";
import AppointmentCard from "../../components/AppointmentCard";

function getLocalDateIso() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

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
  const todayIso = getLocalDateIso();

  return (
    <div>
      <h3>My Appointments</h3>
      {error && <div className="alert">{error}</div>}
      {message && (
        <div className="alert" style={{ color: "#d3f2d3", background: "rgba(0,255,0,0.08)", borderColor: "rgba(0,255,0,0.3)" }}>
          {message}
        </div>
      )}
      <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
        {appointments.map((appt) => {
          const slots = slotsByDoctor[appt.doctor] || [];
          const canModify = ["pending", "confirmed"].includes(appt.status) && appt.slot_date >= todayIso;
          const canDelete = ["cancelled", "completed"].includes(appt.status) || appt.slot_date < todayIso;
          
          const actionButtons = [];
          
          if (canModify) {
            actionButtons.push(
              <button
                key="reschedule"
                className="btn"
                style={{ width: "auto", padding: "8px 12px" }}
                onClick={() => handleToggleReschedule(appt)}
              >
                {openRescheduleId === appt.id ? "Hide Reschedule" : "Reschedule"}
              </button>
            );
            actionButtons.push(
              <button
                key="cancel"
                className="btn"
                style={{ width: "auto", padding: "8px 12px" }}
                onClick={() => handleCancel(appt.id)}
              >
                Cancel
              </button>
            );
          }
          
          if (canDelete) {
            actionButtons.push(
              <button
                key="delete"
                className="btn"
                style={{ width: "auto", padding: "8px 12px" }}
                onClick={() => handleDelete(appt.id)}
              >
                Delete
              </button>
            );
          }

          return (
            <AppointmentCard
              key={appt.id}
              appointment={appt}
              isDoctor={false}
              actions={actionButtons}
            >
              {canModify && openRescheduleId === appt.id && (
                <div className="form-group">
                  <label>Reschedule to slot</label>
                  <select
                    value={rescheduleMap[appt.id] || ""}
                    onChange={(e) => setRescheduleMap((prev) => ({ ...prev, [appt.id]: e.target.value }))}
                  >
                    <option value="">Choose slot</option>
                    {slots.map((slot) => (
                      <option key={slot.id} value={slot.id}>
                        {slot.date} - {slot.shift_label || `${slot.start_time} - ${slot.end_time}`}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn"
                    style={{ width: "auto", padding: "8px 12px", marginTop: 8 }}
                    disabled={!rescheduleMap[appt.id]}
                    onClick={() => handleReschedule(appt.id)}
                  >
                    Confirm Reschedule
                  </button>
                </div>
              )}
              {!canModify && !canDelete && (
                <p className="small" style={{ textAlign: "left", marginBottom: 0 }}>
                  This appointment can no longer be cancelled or rescheduled.
                </p>
              )}
            </AppointmentCard>
          );
        })}
        {!appointments.length && !loading && <p className="small">No appointments yet.</p>}
      </div>
    </div>
  );
}
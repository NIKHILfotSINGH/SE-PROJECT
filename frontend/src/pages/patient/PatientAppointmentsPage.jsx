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
  const todayIso = new Date().toISOString().slice(0, 10);

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
          return (
            <div key={appt.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12, background: "var(--surface)" }}>
              <p style={{ margin: 0 }}>Doctor: {appt.doctor_name} ({appt.doctor_speciality})</p>
              <p style={{ margin: "6px 0" }}>Date/Time: {appt.slot_date} {appt.slot_start_time} - {appt.slot_end_time}</p>
              <p style={{ margin: "6px 0" }}>Status: {appt.status}</p>
              <p style={{ margin: "6px 0" }}>Symptoms: {appt.reason || "Not provided"}</p>
              {canModify ? (
                <>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      className="btn"
                      style={{ width: "auto", padding: "8px 12px" }}
                      onClick={() => handleToggleReschedule(appt)}
                    >
                      {openRescheduleId === appt.id ? "Hide Reschedule" : "Reschedule"}
                    </button>
                    <button className="btn" style={{ width: "auto", padding: "8px 12px" }} onClick={() => handleCancel(appt.id)}>
                      Cancel
                    </button>
                  </div>

                  {openRescheduleId === appt.id && (
                    <div className="form-group" style={{ marginTop: 10, marginBottom: 4 }}>
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
                </>
              ) : (
                <p className="small" style={{ textAlign: "left", marginBottom: 0 }}>
                  This appointment can no longer be cancelled or rescheduled.
                </p>
              )}
              {canDelete && (
                <div style={{ marginTop: 10 }}>
                  <button className="btn" style={{ width: "auto", padding: "8px 12px" }} onClick={() => handleDelete(appt.id)}>
                    Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {!appointments.length && !loading && <p className="small">No appointments yet.</p>}
      </div>
    </div>
  );
}
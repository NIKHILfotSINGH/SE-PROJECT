import React from "react";
import {
  cancelAppointment,
  getAdminDashboardSummary,
  getApiErrorMessage,
  getDoctorSlots,
  getDoctors,
  rescheduleAppointment,
} from "../../services/hospitalApi";

const DEFAULT_SUMMARY = {
  total_doctors: 0,
  total_patients: 0,
  appointments_today: 0,
  recent_appointments: [],
};

function toStatusClass(status) {
  if (["pending", "confirmed", "completed", "cancelled"].includes(status)) {
    return status;
  }
  return "pending";
}

function toStatusLabel(status) {
  if (!status) return "Pending";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function AdminOverviewPage() {
  const [summary, setSummary] = React.useState(DEFAULT_SUMMARY);
  const [doctors, setDoctors] = React.useState([]);
  const [slotsByDoctor, setSlotsByDoctor] = React.useState({});
  const [openRescheduleId, setOpenRescheduleId] = React.useState(null);
  const [rescheduleDoctorMap, setRescheduleDoctorMap] = React.useState({});
  const [rescheduleSlotMap, setRescheduleSlotMap] = React.useState({});
  const [actingAppointmentId, setActingAppointmentId] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");

  const todayIso = new Date().toISOString().slice(0, 10);

  const loadOverview = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAdminDashboardSummary({ limit: 20 });
      setSummary({
        total_doctors: data?.total_doctors ?? 0,
        total_patients: data?.total_patients ?? 0,
        appointments_today: data?.appointments_today ?? 0,
        recent_appointments: Array.isArray(data?.recent_appointments) ? data.recent_appointments : [],
      });
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load overview"));
    } finally {
      setLoading(false);
    }
  }, []);

  async function ensureSlotsLoaded(doctorId) {
    const key = String(doctorId || "");
    if (!key || slotsByDoctor[key]) {
      return;
    }
    const data = await getDoctorSlots(doctorId);
    setSlotsByDoctor((prev) => ({ ...prev, [key]: data }));
  }

  React.useEffect(() => {
    loadOverview();
    (async () => {
      try {
        const data = await getDoctors();
        setDoctors(data);
      } catch (err) {
        setError(getApiErrorMessage(err, "Failed to load doctor list"));
      }
    })();
  }, [loadOverview]);

  async function handleCancel(appointment) {
    setError("");
    setMessage("");
    setActingAppointmentId(appointment.id);
    try {
      await cancelAppointment(appointment.id);
      setMessage("Appointment cancelled successfully.");
      if (openRescheduleId === appointment.id) {
        setOpenRescheduleId(null);
      }
      await loadOverview();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to cancel appointment"));
    } finally {
      setActingAppointmentId(null);
    }
  }

  async function handleToggleReschedule(appointment) {
    const isOpen = openRescheduleId === appointment.id;
    if (isOpen) {
      setOpenRescheduleId(null);
      return;
    }

    const defaultDoctorId = String(appointment.doctor || "");
    setRescheduleDoctorMap((prev) => ({ ...prev, [appointment.id]: defaultDoctorId }));
    setRescheduleSlotMap((prev) => ({ ...prev, [appointment.id]: "" }));

    try {
      await ensureSlotsLoaded(defaultDoctorId);
      setOpenRescheduleId(appointment.id);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load available slots"));
    }
  }

  async function handleDoctorSelection(appointmentId, doctorId) {
    setRescheduleDoctorMap((prev) => ({ ...prev, [appointmentId]: doctorId }));
    setRescheduleSlotMap((prev) => ({ ...prev, [appointmentId]: "" }));
    try {
      await ensureSlotsLoaded(doctorId);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load available slots"));
    }
  }

  async function handleConfirmReschedule(appointment) {
    const selectedSlotId = rescheduleSlotMap[appointment.id];
    if (!selectedSlotId) {
      return;
    }

    setError("");
    setMessage("");
    setActingAppointmentId(appointment.id);
    try {
      await rescheduleAppointment(appointment.id, selectedSlotId);
      setMessage("Appointment rescheduled successfully.");
      setOpenRescheduleId(null);
      await loadOverview();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to reschedule appointment"));
    } finally {
      setActingAppointmentId(null);
    }
  }

  return (
    <div>
      <h3>Today at a glance</h3>
      {error && <div className="alert">{error}</div>}
      {message && (
        <div className="alert" style={{ color: "#d3f2d3", background: "rgba(0,255,0,0.08)", borderColor: "rgba(0,255,0,0.3)" }}>
          {message}
        </div>
      )}
      <div className="admin-metrics-grid">
        <div className="admin-metric-card">
          <p className="admin-metric-label">Doctors</p>
          <h2 className="admin-metric-value">{summary.total_doctors}</h2>
        </div>
        <div className="admin-metric-card">
          <p className="admin-metric-label">Patients</p>
          <h2 className="admin-metric-value">{summary.total_patients}</h2>
        </div>
        <div className="admin-metric-card">
          <p className="admin-metric-label">Appointments Today</p>
          <h2 className="admin-metric-value">{summary.appointments_today}</h2>
        </div>
      </div>

      <h4>Recent Appointments</h4>
      <div className="admin-appointments-panel">
        {loading ? (
          <p className="small" style={{ textAlign: "left", margin: 0 }}>Loading appointments...</p>
        ) : summary.recent_appointments.length ? (
          <div className="admin-appointments-table-wrap">
            <table className="admin-appointments-table">
              <thead>
                <tr>
                  <th>Patient Name</th>
                  <th>Doctor Name</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {summary.recent_appointments.map((appointment) => {
                  const statusClass = toStatusClass(appointment.status);
                  const canManage = ["pending", "confirmed"].includes(statusClass) && (appointment.slot_date || "") >= todayIso;
                  const selectedDoctorId = rescheduleDoctorMap[appointment.id] || String(appointment.doctor || "");
                  const availableSlots = slotsByDoctor[String(selectedDoctorId)] || [];
                  const timeRange = appointment.slot_end_time
                    ? `${appointment.slot_start_time} - ${appointment.slot_end_time}`
                    : appointment.slot_start_time || "-";
                  return (
                    <tr key={appointment.id}>
                      <td>{appointment.patient_name || "Unknown"}</td>
                      <td>{appointment.doctor_name || "Unknown"}</td>
                      <td>{appointment.slot_date || "-"}</td>
                      <td>{timeRange}</td>
                      <td>
                        <span className={`admin-status-badge admin-status-${statusClass}`}>
                          {toStatusLabel(statusClass)}
                        </span>
                      </td>
                      <td>
                        {canManage ? (
                          <div style={{ display: "grid", gap: 6, minWidth: 220 }}>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <button
                                type="button"
                                className="btn"
                                style={{ width: "auto", padding: "6px 10px" }}
                                disabled={actingAppointmentId === appointment.id}
                                onClick={() => handleCancel(appointment)}
                              >
                                {actingAppointmentId === appointment.id ? "Saving..." : "Cancel"}
                              </button>
                              <button
                                type="button"
                                className="btn"
                                style={{ width: "auto", padding: "6px 10px" }}
                                onClick={() => handleToggleReschedule(appointment)}
                              >
                                {openRescheduleId === appointment.id ? "Hide" : "Reschedule"}
                              </button>
                            </div>

                            {openRescheduleId === appointment.id && (
                              <>
                                <select
                                  value={selectedDoctorId}
                                  onChange={(e) => handleDoctorSelection(appointment.id, e.target.value)}
                                >
                                  <option value="">Select doctor</option>
                                  {doctors.map((doctor) => (
                                    <option key={doctor.doctor_id} value={doctor.doctor_id}>
                                      {doctor.username} - {doctor.speciality}
                                    </option>
                                  ))}
                                </select>

                                <select
                                  value={rescheduleSlotMap[appointment.id] || ""}
                                  onChange={(e) =>
                                    setRescheduleSlotMap((prev) => ({
                                      ...prev,
                                      [appointment.id]: e.target.value,
                                    }))
                                  }
                                >
                                  <option value="">Select slot</option>
                                  {availableSlots.map((slot) => (
                                    <option key={slot.id} value={slot.id}>
                                      {slot.date} - {slot.shift_label || `${slot.start_time} - ${slot.end_time}`}
                                    </option>
                                  ))}
                                </select>

                                <button
                                  type="button"
                                  className="btn"
                                  style={{ width: "auto", padding: "6px 10px" }}
                                  disabled={!rescheduleSlotMap[appointment.id] || actingAppointmentId === appointment.id}
                                  onClick={() => handleConfirmReschedule(appointment)}
                                >
                                  Confirm Reschedule
                                </button>
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="small">No actions</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="small" style={{ textAlign: "left", margin: 0 }}>
            No recent appointments found.
          </p>
        )}
      </div>
    </div>
  );
}
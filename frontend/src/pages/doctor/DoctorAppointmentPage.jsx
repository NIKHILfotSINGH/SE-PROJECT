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

  const filteredAppointments = appointments.filter((appt) => {
    if (activeTab === "current") return CURRENT_STATUSES.has(appt.status);
    return PAST_STATUSES.has(appt.status);
  });

  return (
    <div>
      <h3>Appointments</h3>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          type="button"
          className="btn"
          style={{ width: "auto", padding: "8px 12px", opacity: activeTab === "current" ? 1 : 0.7 }}
          onClick={() => setActiveTab("current")}
        >
          Current / Upcoming
        </button>
        <button
          type="button"
          className="btn"
          style={{ width: "auto", padding: "8px 12px", opacity: activeTab === "past" ? 1 : 0.7 }}
          onClick={() => setActiveTab("past")}
        >
          Past
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {[
          ["all", "All"],
          ["today", "Today"],
          ["week", "This Week"],
          ["month", "This Month"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className="btn"
            style={{ width: "auto", padding: "8px 12px", opacity: timeRange === value ? 1 : 0.72 }}
            onClick={() => setTimeRange(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="alert">{error}</div>}
      {message && (
        <div className="alert" style={{ color: "#d3f2d3", background: "rgba(0,255,0,0.08)", borderColor: "rgba(0,255,0,0.3)" }}>
          {message}
        </div>
      )}

      <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
        {filteredAppointments.map((appt) => {
          const reportDraft = reportMap[appt.id] || initialReportState(appt);
          const editable = CURRENT_STATUSES.has(appt.status);
          const isSaving = Boolean(savingReports[appt.id]);

          return (
            <div key={appt.id} style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: 12 }}>
              <p style={{ margin: 0 }}>Patient: {appt.patient_name} (ID: {appt.patient})</p>
              <p style={{ margin: "6px 0" }}>
                Date/Time: {appt.slot_date} {appt.slot_start_time} - {appt.slot_end_time}
              </p>
              <p style={{ margin: "6px 0" }}>Status: {appt.status}</p>
              <p style={{ margin: "6px 0" }}>Symptoms: {appt.reason || "Not provided"}</p>

              {editable && (
                <>
                  <div style={{ marginBottom: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      className="btn"
                      style={{ width: "auto", padding: "8px 12px" }}
                      onClick={() => handleViewPatientProfile(appt)}
                    >
                      View Patient Profile
                    </button>
                    <button
                      className="btn"
                      style={{ width: "auto", padding: "8px 12px" }}
                      onClick={() => setOpenRescheduleId((prev) => (prev === appt.id ? null : appt.id))}
                    >
                      {openRescheduleId === appt.id ? "Hide Reschedule" : "Reschedule"}
                    </button>
                    <button className="btn" style={{ width: "auto", padding: "8px 12px" }} onClick={() => handleCancel(appt.id)}>
                      Cancel
                    </button>
                  </div>

                  {openRescheduleId === appt.id && (
                    <div className="form-group" style={{ marginBottom: 8 }}>
                      <label>Reschedule to your slot</label>
                      <select
                        value={rescheduleMap[appt.id] || ""}
                        onChange={(e) => setRescheduleMap((prev) => ({ ...prev, [appt.id]: e.target.value }))}
                      >
                        <option value="">Choose slot</option>
                        {slots
                          .filter((s) => s.is_available)
                          .map((slot) => (
                            <option key={slot.id} value={slot.id}>
                              {slot.date} - {slot.shift_label || `${slot.start_time}-${slot.end_time}`}
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

                  <div className="form-group">
                    <label>Diagnosis *</label>
                    <textarea
                      value={reportDraft.diagnosis}
                      onChange={(e) =>
                        setReportMap((prev) => ({
                          ...prev,
                          [appt.id]: { ...reportDraft, diagnosis: e.target.value },
                        }))
                      }
                      placeholder="Enter diagnosis"
                      required
                    />
                  </div>
                  <button
                    className="btn"
                    style={{ width: "auto", padding: "8px 12px" }}
                    disabled={isSaving}
                    onClick={() => handleSaveReport(appt)}
                  >
                    {isSaving ? "Saving..." : "Save Report"}
                  </button>
                </>
              )}
            </div>
          );
        })}

        {!filteredAppointments.length && (
          <p className="small">
            {activeTab === "current" ? "No current or upcoming appointments." : "No past appointments yet."}
          </p>
        )}
      </div>

      {patientProfileModal.open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 1000,
          }}
          onClick={closePatientProfileModal}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 560,
              maxHeight: "80vh",
              overflowY: "auto",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--card)",
              padding: 16,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <h4 style={{ margin: 0 }}>Patient Profile: {patientProfileModal.patientName}</h4>
              <button className="btn" style={{ width: "auto", padding: "6px 10px" }} onClick={closePatientProfileModal}>
                Close
              </button>
            </div>

            {patientProfileModal.loading && <p className="small" style={{ textAlign: "left" }}>Loading profile...</p>}
            {patientProfileModal.error && <div className="alert">{patientProfileModal.error}</div>}

            {patientProfileModal.data && (
              <div style={{ marginTop: 12 }}>
                <p style={{ margin: "6px 0" }}>Name: {patientProfileModal.data.first_name} {patientProfileModal.data.last_name}</p>
                <p style={{ margin: "6px 0" }}>Username: {patientProfileModal.data.username}</p>
                <p style={{ margin: "6px 0" }}>Email: {patientProfileModal.data.email || "Not provided"}</p>
                <p style={{ margin: "6px 0" }}>Mobile: {patientProfileModal.data.mobile || "Not provided"}</p>
                <p style={{ margin: "6px 0" }}>Age: {patientProfileModal.data.age ?? "Not provided"}</p>
                <p style={{ margin: "6px 0" }}>Gender: {patientProfileModal.data.gender || "Not provided"}</p>
                <p style={{ margin: "6px 0" }}>Height: {patientProfileModal.data.height_cm ?? "Not provided"} cm</p>
                <p style={{ margin: "6px 0" }}>Weight: {patientProfileModal.data.weight_kg ?? "Not provided"} kg</p>
                <p style={{ margin: "6px 0" }}>Blood Group: {patientProfileModal.data.blood_group || "Not provided"}</p>
                <p style={{ margin: "6px 0", whiteSpace: "pre-wrap" }}>
                  Disability Notes: {patientProfileModal.data.disability_notes || "Not provided"}
                </p>
                <p style={{ margin: "6px 0", whiteSpace: "pre-wrap" }}>
                  Previous Diagnosis: {patientProfileModal.data.previous_diagnosis || "Not provided"}
                </p>
                <p style={{ margin: "6px 0", whiteSpace: "pre-wrap" }}>
                  Allergies: {patientProfileModal.data.allergies || "NA"}
                </p>
                <p style={{ margin: "6px 0", whiteSpace: "pre-wrap" }}>
                  Chronic Conditions: {patientProfileModal.data.chronic_conditions || "NA"}
                </p>
                <p style={{ margin: "6px 0", whiteSpace: "pre-wrap" }}>
                  Current Medications: {patientProfileModal.data.current_medications || "NA"}
                </p>
                <p style={{ margin: "6px 0", whiteSpace: "pre-wrap" }}>
                  Major Past Surgeries: {patientProfileModal.data.major_past_surgeries || "NA"}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
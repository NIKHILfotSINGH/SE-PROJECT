import React from "react";

const statusColorMap = {
  pending: { border: "#20d2c4", bg: "rgba(32, 210, 196, 0.12)", text: "#20d2c4" },
  confirmed: { border: "#4ade80", bg: "rgba(74, 222, 128, 0.12)", text: "#4ade80" },
  cancelled: { border: "#ff4757", bg: "rgba(255, 71, 87, 0.12)", text: "#ff4757" },
  completed: { border: "#4ade80", bg: "rgba(74, 222, 128, 0.12)", text: "#4ade80" },
};

export default function AppointmentCard({
  appointment,
  isDoctor = false,
  actions = [],
  children = null,
}) {
  const statusInfo = statusColorMap[appointment.status] || statusColorMap.pending;
  const personName = isDoctor ? appointment.patient_name : appointment.doctor_name;
  const personDetail = isDoctor
    ? `Patient ID: ${appointment.patient}`
    : `Specialty: ${appointment.doctor_speciality}`;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 16,
        borderLeft: `4px solid ${statusInfo.border}`,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {/* Content Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Left Column */}
        <div>
          <div style={{ marginBottom: 12 }}>
            <p className="appointment-card-label" style={{ margin: 0 }}>
              {isDoctor ? "Patient" : "Doctor"}
            </p>
            <p className="appointment-card-value" style={{ margin: "4px 0 0 0", fontSize: 14 }}>
              {personName}
            </p>
            <p className="appointment-card-value" style={{ margin: "2px 0 0 0", fontSize: 12 }}>
              {personDetail}
            </p>
          </div>
        </div>

        {/* Right Column - Status Badge */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "6px 12px",
              borderRadius: 8,
              background: statusInfo.bg,
              border: `1px solid ${statusInfo.border}`,
              fontSize: 12,
              fontWeight: 600,
              color: statusInfo.text,
              textTransform: "capitalize",
            }}
          >
            {appointment.status}
          </div>
        </div>
      </div>

      {/* Date/Time and Symptoms Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <p className="appointment-card-label" style={{ margin: "0 0 4px 0" }}>
            Date & Time
          </p>
          <p className="appointment-card-value" style={{ margin: 0, fontSize: 14 }}>
            {appointment.slot_date}
          </p>
          <p className="appointment-card-value" style={{ margin: "2px 0 0 0", fontSize: 12 }}>
            {appointment.slot_start_time} - {appointment.slot_end_time}
          </p>
        </div>

        <div>
          <p className="appointment-card-label" style={{ margin: "0 0 4px 0" }}>
            Symptoms
          </p>
          <p className="appointment-card-value" style={{ margin: 0, fontSize: 14 }}>
            {appointment.reason || "Not provided"}
          </p>
        </div>
      </div>

      {/* Custom Content (for doctor's report textarea, etc.) */}
      {children && <div>{children}</div>}

      {/* Action Buttons */}
      {actions.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "flex-end",
            marginTop: 8,
          }}
        >
          {actions}
        </div>
      )}
    </div>
  );
}

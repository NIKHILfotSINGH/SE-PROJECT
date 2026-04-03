import React from "react";
import {
  createDoctorWeeklyAvailability,
  getDoctorOwnSlots,
  getDoctorWeeklyAvailability,
  updateDoctorSlot,
  updateDoctorWeeklyAvailability,
} from "../../services/hospitalApi";

const WEEK_DAYS = [
  { value: 0, label: "Monday" },
  { value: 1, label: "Tuesday" },
  { value: 2, label: "Wednesday" },
  { value: 3, label: "Thursday" },
  { value: 4, label: "Friday" },
  { value: 5, label: "Saturday" },
  { value: 6, label: "Sunday" },
];

const SHIFTS = [
  { value: "morning", label: "Morning (09:00-12:00)" },
  { value: "evening", label: "Evening (13:00-16:00)" },
  { value: "night", label: "Night (18:00-21:00)" },
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthLabel(date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function DoctorSlotsPage() {
  const [availabilityForm, setAvailabilityForm] = React.useState({ weekday: "", shift_type: "morning" });
  const [availabilityRules, setAvailabilityRules] = React.useState([]);
  const [slots, setSlots] = React.useState([]);
  const [visibleMonth, setVisibleMonth] = React.useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");

  const slotsByDate = React.useMemo(() => {
    const grouped = {};
    for (const slot of slots) {
      if (!grouped[slot.date]) {
        grouped[slot.date] = [];
      }
      grouped[slot.date].push(slot);
    }
    return grouped;
  }, [slots]);

  const selectedDateSlots = React.useMemo(() => {
    if (!selectedDate) return [];
    return slotsByDate[selectedDate] || [];
  }, [selectedDate, slotsByDate]);

  const calendarCells = React.useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const firstWeekday = firstDay.getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const cells = [];

    for (let i = 0; i < firstWeekday; i += 1) {
      cells.push(null);
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const isoDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      cells.push({
        isoDate,
        day,
        hasSlots: Boolean(slotsByDate[isoDate]?.length),
      });
    }

    while (cells.length % 7 !== 0) {
      cells.push(null);
    }

    return cells;
  }, [visibleMonth, slotsByDate]);

  async function loadData() {
    const [ruleData, slotData] = await Promise.all([getDoctorWeeklyAvailability(), getDoctorOwnSlots()]);
    setAvailabilityRules(ruleData);
    setSlots(slotData);
  }

  React.useEffect(() => {
    loadData().catch((err) => setError(err.message || "Failed to load slot configuration"));
  }, []);

  React.useEffect(() => {
    if (selectedDate && slotsByDate[selectedDate]?.length) {
      return;
    }

    const monthPrefix = `${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, "0")}`;
    const monthDates = Object.keys(slotsByDate)
      .filter((dateStr) => dateStr.startsWith(monthPrefix))
      .sort();

    if (monthDates.length) {
      setSelectedDate(monthDates[0]);
      return;
    }

    const allDates = Object.keys(slotsByDate).sort();
    setSelectedDate(allDates[0] || "");
  }, [slotsByDate, selectedDate, visibleMonth]);

  async function handleCreateWeeklyRule(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await createDoctorWeeklyAvailability({
        weekday: Number(availabilityForm.weekday),
        shift_type: availabilityForm.shift_type,
        is_active: true,
      });
      setAvailabilityForm({ weekday: "", shift_type: "morning" });
      setMessage("Weekly availability saved. Fixed shift slots generated for upcoming days.");
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to save weekly availability");
    }
  }

  async function toggleRuleActive(rule) {
    setError("");
    setMessage("");
    try {
      await updateDoctorWeeklyAvailability(rule.id, { is_active: !rule.is_active });
      setMessage("Weekly availability updated.");
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to update weekly availability");
    }
  }

  async function toggleSlotAvailability(slot) {
    setError("");
    setMessage("");
    try {
      await updateDoctorSlot(slot.id, { is_available: !slot.is_available });
      await loadData();
      setMessage("Slot updated.");
    } catch (err) {
      setError(err.message || "Slot update failed");
    }
  }

  return (
    <div>
      <h3>Fixed Shift Scheduling</h3>
      {error && <div className="alert">{error}</div>}
      {message && (
        <div className="alert" style={{ color: "#d3f2d3", background: "rgba(0,255,0,0.08)", borderColor: "rgba(0,255,0,0.3)" }}>
          {message}
        </div>
      )}

      <form onSubmit={handleCreateWeeklyRule} style={{ marginBottom: 14 }}>
        <div className="form-group">
          <label>Weekday</label>
          <select
            value={availabilityForm.weekday}
            onChange={(e) => setAvailabilityForm((prev) => ({ ...prev, weekday: e.target.value }))}
            required
          >
            <option value="">Select weekday</option>
            {WEEK_DAYS.map((day) => (
              <option key={day.value} value={day.value}>
                {day.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Shift</label>
          <select
            value={availabilityForm.shift_type}
            onChange={(e) => setAvailabilityForm((prev) => ({ ...prev, shift_type: e.target.value }))}
            required
          >
            {SHIFTS.map((shift) => (
              <option key={shift.value} value={shift.value}>
                {shift.label}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" className="btn">Save Weekly Shift Rule</button>
      </form>

      <h3>Weekly Shift Rules</h3>
      <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
        {availabilityRules.map((rule) => (
          <div key={rule.id} style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: 10 }}>
            <p style={{ margin: 0 }}>
              {rule.weekday_name} - {rule.shift_label || `${rule.start_time}-${rule.end_time}`}
            </p>
            <p style={{ margin: "6px 0" }}>Active: {String(rule.is_active)}</p>
            <button className="btn" style={{ width: "auto", padding: "8px 12px" }} onClick={() => toggleRuleActive(rule)}>
              Toggle Rule
            </button>
          </div>
        ))}
        {!availabilityRules.length && <p className="small">No weekly shift rules set yet.</p>}
      </div>

      <h3>Generated Slots</h3>
      <div style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: 12, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <button
            type="button"
            className="btn"
            style={{ width: "auto", padding: "8px 12px" }}
            onClick={() =>
              setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
            }
          >
            Prev
          </button>
          <h4 style={{ margin: 0 }}>{monthLabel(visibleMonth)}</h4>
          <button
            type="button"
            className="btn"
            style={{ width: "auto", padding: "8px 12px" }}
            onClick={() =>
              setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
            }
          >
            Next
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6, marginBottom: 8 }}>
          {DAY_LABELS.map((label) => (
            <div key={label} style={{ textAlign: "center", fontSize: 12, opacity: 0.72 }}>
              {label}
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6 }}>
          {calendarCells.map((cell, index) => {
            if (!cell) {
              return <div key={`empty-${index}`} style={{ minHeight: 42 }} />;
            }

            const selected = cell.isoDate === selectedDate;
            return (
              <button
                key={cell.isoDate}
                type="button"
                onClick={() => setSelectedDate(cell.isoDate)}
                style={{
                  minHeight: 42,
                  borderRadius: 8,
                  border: cell.hasSlots ? "1px solid rgba(68,215,182,0.55)" : "1px solid rgba(255,255,255,0.12)",
                  background: selected
                    ? "linear-gradient(90deg,var(--accent),var(--accent-2))"
                    : cell.hasSlots
                      ? "rgba(68,215,182,0.16)"
                      : "transparent",
                  color: "var(--text)",
                  cursor: "pointer",
                  fontWeight: cell.hasSlots ? 700 : 500,
                }}
              >
                {cell.day}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
        {selectedDate ? (
          <p className="small" style={{ textAlign: "left", margin: 0 }}>
            Showing slots for {selectedDate}
          </p>
        ) : (
          <p className="small" style={{ textAlign: "left", margin: 0 }}>
            Select a day in the calendar to view slots.
          </p>
        )}

        {selectedDateSlots.map((slot) => (
          <div key={slot.id} style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: 10 }}>
            <p style={{ margin: 0 }}>
              {slot.date} - {slot.shift_label || `${slot.start_time}-${slot.end_time}`}
            </p>
            <p style={{ margin: "6px 0" }}>Available: {String(slot.is_available)}</p>
            <button className="btn" style={{ width: "auto", padding: "8px 12px" }} onClick={() => toggleSlotAvailability(slot)}>
              Toggle Availability
            </button>
          </div>
        ))}

        {!slots.length && <p className="small">No generated slots available yet.</p>}
        {Boolean(slots.length) && selectedDate && !selectedDateSlots.length && (
          <p className="small">No generated slots on this date.</p>
        )}
      </div>
    </div>
  );
}
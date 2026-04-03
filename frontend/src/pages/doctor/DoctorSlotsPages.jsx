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
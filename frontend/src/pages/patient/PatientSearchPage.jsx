import React from "react";
import { bookAppointment, getApiErrorMessage, getDoctorSlots, getDoctors } from "../../services/hospitalApi";

export default function PatientSearchPage() {
  const [activeTab, setActiveTab] = React.useState("search");
  const [query, setQuery] = React.useState("");
  const [doctors, setDoctors] = React.useState([]);
  const [selectedDoctorProfile, setSelectedDoctorProfile] = React.useState(null);
  const [isDoctorProfileOpen, setIsDoctorProfileOpen] = React.useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = React.useState("");
  const [slots, setSlots] = React.useState([]);
  const [selectedSlotId, setSelectedSlotId] = React.useState("");
  const [symptoms, setSymptoms] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  async function loadDoctors(search = "") {
    const clean = search.trim();
    const data = await getDoctors(clean ? { search: clean } : {});
    setDoctors(data);
    return data;
  }

  async function loadSlots(doctorId) {
    if (!doctorId) {
      setSlots([]);
      return;
    }
    const data = await getDoctorSlots(doctorId);
    setSlots(data);
  }

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await loadDoctors();
      } catch (err) {
        setError(getApiErrorMessage(err, "Failed to load doctors"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  React.useEffect(() => {
    loadSlots(selectedDoctorId).catch((err) => setError(getApiErrorMessage(err, "Failed to load slots")));
  }, [selectedDoctorId]);

  async function handleSearch(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      const data = await loadDoctors(query);
      if (!data.length) {
        setSelectedDoctorProfile(null);
        setIsDoctorProfileOpen(false);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Doctor search failed"));
    }
  }

  async function handleBook(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!symptoms.trim()) {
      setError("Please describe your symptoms or reason for visit.");
      return;
    }
    try {
      await bookAppointment({ slot_id: Number(selectedSlotId), reason: symptoms.trim() });
      setMessage("Appointment booked successfully.");
      setSelectedSlotId("");
      setSymptoms("");
      await loadSlots(selectedDoctorId);
    } catch (err) {
      setError(getApiErrorMessage(err, "Booking failed"));
    }
  }

  function handleBookWithDoctor(doctorId) {
    setSelectedDoctorId(String(doctorId));
    setActiveTab("book");
  }

  const selectedDoctor = doctors.find((doc) => String(doc.doctor_id) === String(selectedDoctorId));

  function openDoctorProfile(doctor) {
    setSelectedDoctorProfile(doctor);
    setIsDoctorProfileOpen(true);
  }

  function closeDoctorProfile() {
    setIsDoctorProfileOpen(false);
  }

  async function handleResetSearch() {
    setError("");
    setMessage("");
    setQuery("");
    try {
      const data = await loadDoctors();
      setSelectedDoctorProfile(null);
      setIsDoctorProfileOpen(false);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to refresh doctor list"));
    }
  }

  return (
    <div>
      <h3>Find & Book Doctors</h3>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          type="button"
          className="btn"
          style={{ width: "auto", padding: "8px 12px", opacity: activeTab === "search" ? 1 : 0.72 }}
          onClick={() => setActiveTab("search")}
        >
          Search
        </button>
        <button
          type="button"
          className="btn"
          style={{ width: "auto", padding: "8px 12px", opacity: activeTab === "book" ? 1 : 0.72 }}
          onClick={() => setActiveTab("book")}
        >
          Book Appointment
        </button>
      </div>

      {error && <div className="alert">{error}</div>}
      {message && (
        <div className="alert" style={{ color: "#d3f2d3", background: "rgba(0,255,0,0.08)", borderColor: "rgba(0,255,0,0.3)" }}>
          {message}
        </div>
      )}

      {activeTab === "search" && (
        <>
          <form onSubmit={handleSearch} style={{ marginBottom: 16 }}>
            <div className="form-group">
              <label>Search by name or speciality</label>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. Cardiology" />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="submit" className="btn" disabled={loading} style={{ width: "auto", padding: "8px 12px" }}>
                Search
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleResetSearch}
                style={{ width: "auto", padding: "8px 12px", opacity: 0.86 }}
              >
                Show All Doctors
              </button>
            </div>
          </form>

          <div style={{ display: "grid", gap: 10 }}>
            {doctors.map((doc) => (
              <div key={doc.doctor_id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12, background: "var(--surface)" }}>
                <p style={{ margin: 0, fontWeight: 700 }}>
                  Dr. {doc.first_name || doc.username} {doc.last_name || ""}
                </p>
                <p style={{ margin: "6px 0" }}>
                  {doc.speciality} • {doc.experience_years} years experience
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn"
                    style={{ width: "auto", padding: "8px 12px" }}
                    onClick={() => openDoctorProfile(doc)}
                  >
                    View Profile
                  </button>
                  <button
                    type="button"
                    className="btn"
                    style={{ width: "auto", padding: "8px 12px", opacity: 0.9 }}
                    onClick={() => handleBookWithDoctor(doc.doctor_id)}
                  >
                    Book with This Doctor
                  </button>
                </div>
              </div>
            ))}
          </div>

          {!loading && !doctors.length && <p className="small">No doctors found. Try another search.</p>}
        </>
      )}

      {activeTab === "book" && (
        <>
          <form onSubmit={handleBook} style={{ marginBottom: 20 }}>
            <div className="form-group">
              <label>Select Doctor</label>
              <select value={selectedDoctorId} onChange={(e) => setSelectedDoctorId(e.target.value)}>
                <option value="">Choose doctor</option>
                {doctors.map((doc) => (
                  <option key={doc.doctor_id} value={doc.doctor_id}>
                    {doc.username} - {doc.speciality} ({doc.experience_years} yrs)
                  </option>
                ))}
              </select>
            </div>

            {selectedDoctor && (
              <p className="small" style={{ textAlign: "left", marginTop: -6, marginBottom: 12 }}>
                Booking with Dr. {selectedDoctor.first_name || selectedDoctor.username} ({selectedDoctor.speciality})
              </p>
            )}

            <div className="form-group">
              <label>Available Slot</label>
              <select value={selectedSlotId} onChange={(e) => setSelectedSlotId(e.target.value)} required>
                <option value="">Select slot</option>
                {slots.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {slot.date} - {slot.shift_label || `${slot.start_time} - ${slot.end_time}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Symptoms / Reason</label>
              <textarea
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder="Briefly describe your symptoms or reason for booking"
                required
              />
            </div>
            <button type="submit" className="btn" disabled={!selectedSlotId}>
              Book Slot
            </button>
          </form>
          {!selectedDoctorId && <p className="small">Select a doctor to see available slots.</p>}
        </>
      )}

      {isDoctorProfileOpen && selectedDoctorProfile && (
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
          onClick={closeDoctorProfile}
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
              <h4 style={{ margin: 0 }}>Doctor Profile</h4>
              <button className="btn" style={{ width: "auto", padding: "6px 10px" }} onClick={closeDoctorProfile}>
                Close
              </button>
            </div>

            <div style={{ marginTop: 12 }}>
              <p style={{ margin: "6px 0" }}>
                Name: Dr. {selectedDoctorProfile.first_name || selectedDoctorProfile.username} {selectedDoctorProfile.last_name || ""}
              </p>
              <p style={{ margin: "6px 0" }}>Email: {selectedDoctorProfile.email || "Not provided"}</p>
              <p style={{ margin: "6px 0" }}>Age: {selectedDoctorProfile.age ?? "Not provided"}</p>
              <p style={{ margin: "6px 0" }}>Speciality: {selectedDoctorProfile.speciality || "Not provided"}</p>
              <p style={{ margin: "6px 0" }}>Qualification: {selectedDoctorProfile.qualification || "Not provided"}</p>
              <p style={{ margin: "6px 0" }}>Experience: {selectedDoctorProfile.experience_years || 0} years</p>
              <p style={{ margin: "6px 0", whiteSpace: "pre-wrap" }}>Bio: {selectedDoctorProfile.bio || "Not provided"}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
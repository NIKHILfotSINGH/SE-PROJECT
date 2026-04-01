import React from "react";
import { getDoctorProfile, updateDoctorProfile } from "../../services/hospitalApi";
import { useAuth } from "../../auth/AuthProvider";

export default function DoctorProfilePage() {
  const { setProfileCompletion } = useAuth();
  const [profile, setProfile] = React.useState({
    first_name: "",
    last_name: "",
    email: "",
    speciality: "",
    experience_years: 0,
    age: "",
    qualification: "",
    bio: "",
  });
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");

  function normalizeProfile(data = {}) {
    return {
      first_name: data.first_name || "",
      last_name: data.last_name || "",
      email: data.email || "",
      speciality: data.speciality || "",
      experience_years: data.experience_years ?? 0,
      age: data.age ?? "",
      qualification: data.qualification || "",
      bio: data.bio || "",
    };
  }

  React.useEffect(() => {
    (async () => {
      try {
        const data = await getDoctorProfile();
        setProfile(normalizeProfile(data));
      } catch (err) {
        setError(err.message || "Failed to load profile");
      }
    })();
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      const payload = {
        ...profile,
        experience_years: Number(profile.experience_years || 0),
        age: profile.age === "" ? null : Number(profile.age),
      };
      const updated = await updateDoctorProfile(payload);
      setProfile(normalizeProfile(updated));
      const completed =
        Boolean((updated.first_name || "").trim()) &&
        Boolean((updated.last_name || "").trim()) &&
        (updated.age !== null && updated.age !== undefined) &&
        Boolean((updated.speciality || "").trim()) &&
        updated.experience_years !== null &&
        updated.experience_years !== undefined &&
        Boolean((updated.qualification || "").trim());
      setProfileCompletion(completed);
      setMessage("Doctor profile updated.");
    } catch (err) {
      setError(err.message || "Profile update failed");
    }
  }

  return (
    <div>
      <h3>Doctor Profile</h3>
      {error && <div className="alert">{error}</div>}
      {message && (
        <div className="alert" style={{ color: "#d3f2d3", background: "rgba(0,255,0,0.08)", borderColor: "rgba(0,255,0,0.3)" }}>
          {message}
        </div>
      )}
      <form onSubmit={handleSave} style={{ marginBottom: 20 }}>
        <div className="form-group">
          <label>First Name</label>
          <input value={profile.first_name || ""} onChange={(e) => setProfile((p) => ({ ...p, first_name: e.target.value }))} required />
        </div>
        <div className="form-group">
          <label>Last Name</label>
          <input value={profile.last_name || ""} onChange={(e) => setProfile((p) => ({ ...p, last_name: e.target.value }))} required />
        </div>
        <div className="form-group">
          <label>Email</label>
          <input type="email" value={profile.email || ""} onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))} />
        </div>
        <div className="form-group">
          <label>Age</label>
          <input type="number" min="0" value={profile.age ?? ""} onChange={(e) => setProfile((p) => ({ ...p, age: e.target.value }))} required />
        </div>
        <div className="form-group">
          <label>Speciality</label>
          <input value={profile.speciality || ""} onChange={(e) => setProfile((p) => ({ ...p, speciality: e.target.value }))} required />
        </div>
        <div className="form-group">
          <label>Experience (years)</label>
          <input type="number" min="0" value={profile.experience_years ?? 0} onChange={(e) => setProfile((p) => ({ ...p, experience_years: Number(e.target.value) }))} required />
        </div>
        <div className="form-group">
          <label>Qualification</label>
          <input value={profile.qualification || ""} onChange={(e) => setProfile((p) => ({ ...p, qualification: e.target.value }))} required />
        </div>
        <div className="form-group">
          <label>Bio</label>
          <input value={profile.bio || ""} onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))} />
        </div>
        <button type="submit" className="btn">Save Profile</button>
      </form>
    </div>
  );
}
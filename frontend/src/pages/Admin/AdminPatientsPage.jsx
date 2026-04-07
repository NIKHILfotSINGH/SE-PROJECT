import React from "react";
import {
  getAdminUserProfile,
  getAdminUsers,
  getApiErrorMessage,
  setAdminUserStatus,
} from "../../services/hospitalApi";

export default function AdminUsersPage() {
  const [users, setUsers] = React.useState([]);
  const [query, setQuery] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [loading, setLoading] = React.useState(true);
  const [updatingUserId, setUpdatingUserId] = React.useState(null);
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");
  const [profileModal, setProfileModal] = React.useState({
    open: false,
    loading: false,
    error: "",
    data: null,
  });

  async function loadUsers() {
    setError("");
    try {
      setLoading(true);
      const params = {
        search: query.trim() || undefined,
        role: roleFilter === "all" ? undefined : roleFilter,
        status: statusFilter === "all" ? undefined : statusFilter,
      };
      const data = await getAdminUsers(params);
      setUsers(data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load users"));
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadUsers();
  }, [roleFilter, statusFilter]);

  async function handleSearch(e) {
    e.preventDefault();
    await loadUsers();
  }

  async function handleToggleStatus(user) {
    setError("");
    setMessage("");
    setUpdatingUserId(user.id);
    try {
      const response = await setAdminUserStatus(user.id, !user.is_active);
      const cancelledCount = Number(response?.cancelled_appointments || 0);
      if (!user.is_active) {
        setMessage("User activated successfully.");
      } else if (cancelledCount > 0) {
        setMessage(`User deactivated. ${cancelledCount} upcoming appointment(s) were auto-cancelled.`);
      } else {
        setMessage("User deactivated successfully.");
      }
      await loadUsers();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to update user status"));
    } finally {
      setUpdatingUserId(null);
    }
  }

  async function handleViewProfile(userId) {
    setProfileModal({
      open: true,
      loading: true,
      error: "",
      data: null,
    });

    try {
      const data = await getAdminUserProfile(userId);
      setProfileModal({
        open: true,
        loading: false,
        error: "",
        data,
      });
    } catch (err) {
      setProfileModal({
        open: true,
        loading: false,
        error: getApiErrorMessage(err, "Failed to load user profile"),
        data: null,
      });
    }
  }

  function closeProfileModal() {
    setProfileModal({
      open: false,
      loading: false,
      error: "",
      data: null,
    });
  }

  const modalData = profileModal.data;

  return (
    <div>
      <h3>Manage Users</h3>
      {error && <div className="alert">{error}</div>}
      {message && (
        <div className="alert" style={{ color: "#d3f2d3", background: "rgba(0,255,0,0.08)", borderColor: "rgba(0,255,0,0.3)" }}>
          {message}
        </div>
      )}

      <form onSubmit={handleSearch} style={{ display: "grid", gap: 10, marginBottom: 14 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Search user</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by username, name, email, or speciality"
          />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={{ maxWidth: 180 }}>
            <option value="all">All roles</option>
            <option value="doctor">Doctors</option>
            <option value="patient">Patients</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ maxWidth: 180 }}>
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button type="submit" className="btn" style={{ width: "auto", padding: "8px 12px" }}>
            Search
          </button>
        </div>
      </form>

      <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
        {users.map((user) => (
          <div key={user.id} style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: 10 }}>
            <p style={{ margin: "0 0 6px 0", fontWeight: 700 }}>
              {user.first_name || user.last_name
                ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
                : user.username}
            </p>
            <p style={{ margin: "4px 0" }}>Username: {user.username}</p>
            <p style={{ margin: "4px 0" }}>Role: {user.role}</p>
            <p style={{ margin: "4px 0" }}>Email: {user.email || "Not provided"}</p>
            {user.role === "doctor" && <p style={{ margin: "4px 0" }}>Speciality: {user.doctor_speciality || "Not set"}</p>}
            <p style={{ margin: "4px 0" }}>Status: {user.is_active ? "Active" : "Inactive"}</p>

            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn"
                style={{ width: "auto", padding: "8px 12px" }}
                onClick={() => handleViewProfile(user.id)}
              >
                View Profile
              </button>
              <button
                type="button"
                className="btn"
                style={{ width: "auto", padding: "8px 12px" }}
                disabled={updatingUserId === user.id}
                onClick={() => handleToggleStatus(user)}
              >
                {updatingUserId === user.id ? "Saving..." : user.is_active ? "Deactivate" : "Activate"}
              </button>
            </div>
          </div>
        ))}

        {!loading && !users.length && <p className="small">No users found for the selected filters.</p>}
        {loading && <p className="small">Loading users...</p>}
      </div>

      {profileModal.open && (
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
          onClick={closeProfileModal}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 620,
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
              <h4 style={{ margin: 0 }}>User Profile</h4>
              <button className="btn" style={{ width: "auto", padding: "6px 10px" }} onClick={closeProfileModal}>
                Close
              </button>
            </div>

            {profileModal.loading && <p className="small" style={{ textAlign: "left" }}>Loading profile...</p>}
            {profileModal.error && <div className="alert">{profileModal.error}</div>}

            {modalData && (
              <div style={{ marginTop: 12 }}>
                <p style={{ margin: "6px 0" }}>Username: {modalData.username}</p>
                <p style={{ margin: "6px 0" }}>
                  Name: {`${modalData.first_name || ""} ${modalData.last_name || ""}`.trim() || "Not provided"}
                </p>
                <p style={{ margin: "6px 0" }}>Role: {modalData.role}</p>
                <p style={{ margin: "6px 0" }}>Email: {modalData.email || "Not provided"}</p>
                <p style={{ margin: "6px 0" }}>Status: {modalData.is_active ? "Active" : "Inactive"}</p>

                {modalData.doctor_profile && (
                  <>
                    <p style={{ margin: "6px 0" }}>Speciality: {modalData.doctor_profile.speciality || "Not set"}</p>
                    <p style={{ margin: "6px 0" }}>Experience: {modalData.doctor_profile.experience_years ?? 0} years</p>
                    <p style={{ margin: "6px 0" }}>Qualification: {modalData.doctor_profile.qualification || "Not provided"}</p>
                    <p style={{ margin: "6px 0", whiteSpace: "pre-wrap" }}>Bio: {modalData.doctor_profile.bio || "Not provided"}</p>
                  </>
                )}

                {modalData.patient_profile && (
                  <>
                    <p style={{ margin: "6px 0" }}>Mobile: {modalData.patient_profile.mobile || "Not provided"}</p>
                    <p style={{ margin: "6px 0" }}>Age: {modalData.patient_profile.age ?? "Not provided"}</p>
                    <p style={{ margin: "6px 0" }}>Gender: {modalData.patient_profile.gender || "Not provided"}</p>
                    <p style={{ margin: "6px 0" }}>Blood Group: {modalData.patient_profile.blood_group || "Not provided"}</p>
                    <p style={{ margin: "6px 0", whiteSpace: "pre-wrap" }}>Allergies: {modalData.patient_profile.allergies || "NA"}</p>
                    <p style={{ margin: "6px 0", whiteSpace: "pre-wrap" }}>
                      Chronic Conditions: {modalData.patient_profile.chronic_conditions || "NA"}
                    </p>
                    <p style={{ margin: "6px 0", whiteSpace: "pre-wrap" }}>
                      Current Medications: {modalData.patient_profile.current_medications || "NA"}
                    </p>
                    <p style={{ margin: "6px 0", whiteSpace: "pre-wrap" }}>
                      Major Past Surgeries: {modalData.patient_profile.major_past_surgeries || "NA"}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
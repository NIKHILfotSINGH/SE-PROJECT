import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import ThemeToggle from "../../components/ThemeToggle";

export default function PatientLayout() {
  const { user, logout } = useAuth();

  const navStyle = ({ isActive }) => ({
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    textDecoration: "none",
    color: "var(--text)",
    background: isActive ? "linear-gradient(90deg,var(--accent),var(--accent-2))" : "var(--pill)",
    boxShadow: isActive ? "0 8px 24px rgba(68,215,182,0.25)" : "none",
    fontWeight: 600,
  });

  return (
    <div className="app-shell">
      <div className="dashboard">
        <div className="navbar" style={{ gap: 12 }}>
          <div>
            <h2 style={{ margin: 0 }}>Patient Portal</h2>
            <p style={{ margin: 0, fontSize: 14 }}>Hello, {user?.username || "Patient"}. Your role is {user?.role}.</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <NavLink style={navStyle} to="/patient/search">Search & Book</NavLink>
            <NavLink style={navStyle} to="/patient/appointments">Appointments</NavLink>
            <NavLink style={navStyle} to="/patient/profile">Profile</NavLink>
            <ThemeToggle />
            <button className="btn" onClick={logout} style={{ width: "auto", padding: "10px 16px" }}>Logout</button>
          </div>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
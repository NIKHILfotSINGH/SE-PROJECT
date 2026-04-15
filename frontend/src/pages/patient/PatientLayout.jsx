import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import ThemeToggle from "../../components/ThemeToggle";

export default function PatientLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <div className="dashboard">
        <div className="navbar" style={{ gap: 12 }}>
          <div>
            <h2 className="portal-title" style={{ margin: 0 }}>Patient Portal</h2>
            <p className="portal-subtitle" style={{ margin: 0, fontSize: 12 }}>{user?.username?.split('@')[0] || "Patient"} • {user?.role}</p>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center", marginLeft: "auto" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <NavLink className={({ isActive }) => `portal-nav-link${isActive ? " portal-nav-link-active" : ""}`} to="/patient/search">Search & Book</NavLink>
              <NavLink className={({ isActive }) => `portal-nav-link${isActive ? " portal-nav-link-active" : ""}`} to="/patient/appointments">Appointments</NavLink>
              <NavLink className={({ isActive }) => `portal-nav-link${isActive ? " portal-nav-link-active" : ""}`} to="/patient/profile">Profile</NavLink>
            </div>
            <div style={{ width: "1px", height: 24, background: "var(--border)" }} />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <ThemeToggle />
              <button className="btn btn-danger" onClick={logout} style={{ width: "auto", padding: "8px 16px", fontSize: 14 }} aria-label="Logout" title="Logout">⎋</button>
            </div>
          </div>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
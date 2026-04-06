import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export function ProtectedRoute() {
  const { accessToken, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!accessToken) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

export function RoleRoute({ allowed }) {
  const { user, accessToken, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!accessToken) return <Navigate to="/login" replace state={{ from: location }} />;

  // Avoid a false redirect to login during transient post-login state updates.
  if (!user) return null;

  if (!allowed.includes(user.role)) return <Navigate to="/login" replace />;

  const needsProfileCompletion = (user.role === "patient" || user.role === "doctor") && !user.profile_completed;
  const profilePath = `/${user.role}/profile`;
  if (needsProfileCompletion && !location.pathname.startsWith(profilePath)) {
    return <Navigate to={profilePath} replace />;
  }

  return <Outlet />;
}
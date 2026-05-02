// components/ProtectedRoute.jsx
//
// Drop-in guard for react-router-dom v6.
// Reads auth state from AuthContext (defined in App.jsx).
//
// Usage:
//   <Route path="/game"        element={<ProtectedRoute><GamePage /></ProtectedRoute>} />
//   <Route path="/admin-panel" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
//
// Props:
//   children   — the component to render when access is granted
//   adminOnly  — if true, also requires user.is_staff === true
//   redirectTo — where to send unauthenticated users (default: "/login")

import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../App";

export default function ProtectedRoute({
  children,
  adminOnly = false,
  redirectTo = "/login",
}) {
  const { user } = useAuth();
  const location = useLocation();

  // Not logged in → redirect to login, preserving the attempted location
  if (!user) {
    return (
      <Navigate
        to={redirectTo}
        state={{ from: location }}
        replace
      />
    );
  }

  // Logged in but not staff → kick to /game
  if (adminOnly && !user.is_staff) {
    return <Navigate to="/game" replace />;
  }

  return children;
}
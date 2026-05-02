import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

import Navbar from "./components/Navbar";
import FlashMessages from "./components/FlashMessages";

import LoginPage      from "./pages/LoginPage";
import RegisterPage   from "./pages/RegisterPage";
import GamePage       from "./pages/GamePage";
import WalletPage     from "./pages/WalletPage";
import HistoryPage    from "./pages/HistoryPage";
import ProfilePage    from "./pages/ProfilePage";

import AdminDashboard    from "./pages/admin/AdminDashboard";
import AdminUsers        from "./pages/admin/AdminUsers";
import AdminGames        from "./pages/admin/AdminGames";
import AdminTransactions from "./pages/admin/AdminTransactions";
import AdminSettings     from "./pages/admin/AdminSettings";

// ── Auth Context ──────────────────────────────────────────────────────────────
export const AuthContext = createContext(null);
export const FlashContext = createContext(null);

export function useAuth()  { return useContext(AuthContext); }
export function useFlash() { return useContext(FlashContext); }

function parseUser(token) {
  try { return jwtDecode(token); } catch { return null; }
}

function AuthProvider({ children }) {
  const [user, setUser]   = useState(() => parseUser(localStorage.getItem("access_token")));
  const [flashes, setFlashes] = useState([]);

  const login = (access, refresh) => {
    localStorage.setItem("access_token", access);
    localStorage.setItem("refresh_token", refresh);
    setUser(parseUser(access));
  };

  const logout = useCallback(() => {
    localStorage.clear();
    setUser(null);
  }, []);

  const flash = useCallback((message, type = "info") => {
    const id = Date.now() + Math.random();
    setFlashes((f) => [...f, { id, message, type }]);
    setTimeout(() => setFlashes((f) => f.filter((x) => x.id !== id)), 4000);
  }, []);

  const dismissFlash = useCallback((id) => {
    setFlashes((f) => f.filter((x) => x.id !== id));
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <FlashContext.Provider value={{ flash, flashes, dismissFlash }}>
        {children}
      </FlashContext.Provider>
    </AuthContext.Provider>
  );
}

// ── Protected Route ───────────────────────────────────────────────────────────
function Protected({ children, adminOnly = false }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (adminOnly && !user.is_staff) return <Navigate to="/game" replace />;
  return children;
}

// ── Layout wrapper (shows Navbar on authed pages) ─────────────────────────────
function Layout({ children }) {
  const { user } = useAuth();
  return (
    <>
      {user && <Navbar />}
      <FlashMessages />
      <main style={{ minHeight: "calc(100vh - 56px)" }}>
        {children}
      </main>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            {/* Public */}
            <Route path="/login"    element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Player */}
            <Route path="/game"    element={<Protected><GamePage /></Protected>} />
            <Route path="/wallet"  element={<Protected><WalletPage /></Protected>} />
            <Route path="/history" element={<Protected><HistoryPage /></Protected>} />
            <Route path="/profile" element={<Protected><ProfilePage /></Protected>} />

            {/* Admin */}
            <Route path="/admin-panel"              element={<Protected adminOnly><AdminDashboard /></Protected>} />
            <Route path="/admin-panel/users"        element={<Protected adminOnly><AdminUsers /></Protected>} />
            <Route path="/admin-panel/games"        element={<Protected adminOnly><AdminGames /></Protected>} />
            <Route path="/admin-panel/transactions" element={<Protected adminOnly><AdminTransactions /></Protected>} />
            <Route path="/admin-panel/settings"     element={<Protected adminOnly><AdminSettings /></Protected>} />

            {/* Default */}
            <Route path="*" element={<Navigate to="/game" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  );
}
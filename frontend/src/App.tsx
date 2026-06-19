import {
  Routes,
  Route,
  Navigate,
  NavLink,
  useNavigate
} from "react-router-dom";
import { useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { ConnectWhatsApp } from "./pages/ConnectWhatsApp";
import { Groups } from "./pages/Groups";
import { SchedulesList } from "./pages/SchedulesList";
import { ScheduleForm } from "./pages/ScheduleForm";
import { Logs } from "./pages/Logs";

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  if (!user) return <Navigate to="/login" replace />;

  const link = ({ isActive }: { isActive: boolean }) =>
    `block px-3 py-2 rounded text-sm font-medium transition-colors ${
      isActive ? "bg-emerald-600 text-white" : "text-gray-700 hover:bg-gray-100"
    }`;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg sm:text-xl font-semibold text-gray-900">
            WA Scheduler
          </h1>
          <nav className="hidden md:flex gap-1">
            <NavLink to="/connect" className={link}>
              Connect
            </NavLink>
            <NavLink to="/groups" className={link}>
              Groups
            </NavLink>
            <NavLink to="/schedules" className={link}>
              Schedules
            </NavLink>
            <NavLink to="/logs" className={link}>
              Logs
            </NavLink>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <span className="hidden sm:inline text-xs sm:text-sm text-gray-500">
              {user.email}
            </span>
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="text-xs sm:text-sm text-gray-600 hover:text-gray-900 font-medium"
            >
              Logout
            </button>
          </div>
        </div>
        {/* Mobile menu */}
        {mobileNavOpen && (
          <nav className="md:hidden border-t bg-gray-50 px-4 py-2">
            <NavLink
              to="/connect"
              className={({ isActive }) => link({ isActive })}
              onClick={() => setMobileNavOpen(false)}
            >
              Connect
            </NavLink>
            <NavLink
              to="/groups"
              className={({ isActive }) => link({ isActive })}
              onClick={() => setMobileNavOpen(false)}
            >
              Groups
            </NavLink>
            <NavLink
              to="/schedules"
              className={({ isActive }) => link({ isActive })}
              onClick={() => setMobileNavOpen(false)}
            >
              Schedules
            </NavLink>
            <NavLink
              to="/logs"
              className={({ isActive }) => link({ isActive })}
              onClick={() => setMobileNavOpen(false)}
            >
              Logs
            </NavLink>
          </nav>
        )}
      </header>
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 w-full">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/connect"
        element={
          <ProtectedLayout>
            <ConnectWhatsApp />
          </ProtectedLayout>
        }
      />
      <Route
        path="/groups"
        element={
          <ProtectedLayout>
            <Groups />
          </ProtectedLayout>
        }
      />
      <Route
        path="/schedules"
        element={
          <ProtectedLayout>
            <SchedulesList />
          </ProtectedLayout>
        }
      />
      <Route
        path="/schedules/new"
        element={
          <ProtectedLayout>
            <ScheduleForm />
          </ProtectedLayout>
        }
      />
      <Route
        path="/schedules/:id/edit"
        element={
          <ProtectedLayout>
            <ScheduleForm />
          </ProtectedLayout>
        }
      />
      <Route
        path="/logs"
        element={
          <ProtectedLayout>
            <Logs />
          </ProtectedLayout>
        }
      />
      <Route path="*" element={<Navigate to="/connect" replace />} />
    </Routes>
  );
}

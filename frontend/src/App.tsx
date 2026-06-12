import {
  Routes,
  Route,
  Navigate,
  NavLink,
  useNavigate
} from "react-router-dom";
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
  if (!user) return <Navigate to="/login" replace />;

  const link = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded text-sm ${isActive ? "bg-emerald-600 text-white" : "text-gray-700 hover:bg-gray-100"}`;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="font-semibold">WA Scheduler</div>
          <nav className="flex gap-1">
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
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{user.email}</span>
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl mx-auto px-4 py-6 w-full">
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

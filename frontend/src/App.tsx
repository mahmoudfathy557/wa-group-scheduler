import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { isAuthenticated } from './lib/auth';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ConnectPage from './pages/ConnectPage';
import GroupsPage from './pages/GroupsPage';
import SchedulesPage from './pages/SchedulesPage';
import NewSchedulePage from './pages/NewSchedulePage';
import EditSchedulePage from './pages/EditSchedulePage';
import LogsPage from './pages/LogsPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  return isAuthenticated() ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated() ? <Navigate to="/connect" replace /> : <LoginPage />}
      />
      <Route
        path="/register"
        element={isAuthenticated() ? <Navigate to="/connect" replace /> : <RegisterPage />}
      />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/connect" replace />} />
        <Route path="connect" element={<ConnectPage />} />
        <Route path="groups" element={<GroupsPage />} />
        <Route path="schedules" element={<SchedulesPage />} />
        <Route path="schedules/new" element={<NewSchedulePage />} />
        <Route path="schedules/:id/edit" element={<EditSchedulePage />} />
        <Route path="logs" element={<LogsPage />} />
      </Route>
      <Route
        path="*"
        element={<Navigate to={isAuthenticated() ? '/connect' : '/login'} replace />}
      />
    </Routes>
  );
}

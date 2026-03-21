import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Medications from './pages/Medications';
import Reports from './pages/Reports';
import Alerts from './pages/Alerts';
import Appointments from './pages/Appointments';
import Login from './pages/Login';
import DoctorDashboard from './pages/DoctorDashboard';
import CHODashboard from './pages/CHODashboard';
import { useApi } from './api/useApi';
import { useWebSocket } from './api/useWebSocket';
import { useIotData } from './api/useIotData';

function CaretakerLayout({ children }: { children: React.ReactNode }) {
  useApi();
  useIotData();
  useWebSocket();
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'linear-gradient(180deg, #fafbfd 0%, #f1f5f9 100%)' }}>
      <Sidebar />
      <div
        style={{
          flex: 1,
          marginLeft: 'var(--sidebar-width)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
        }}
      >
        <Navbar />
        <main
          style={{
            flex: 1,
            padding: '32px 40px 48px',
            maxWidth: 1640,
            width: '100%',
            margin: '0 auto',
            overflowX: 'hidden',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Default → login */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />

        {/* Caretaker routes */}
        <Route
          path="/caretaker"
          element={
            <CaretakerLayout>
              <Dashboard />
            </CaretakerLayout>
          }
        />
        <Route
          path="/caretaker/medications"
          element={
            <CaretakerLayout>
              <Medications />
            </CaretakerLayout>
          }
        />
        <Route
          path="/caretaker/reports"
          element={
            <CaretakerLayout>
              <Reports />
            </CaretakerLayout>
          }
        />
        <Route
          path="/caretaker/alerts"
          element={
            <CaretakerLayout>
              <Alerts />
            </CaretakerLayout>
          }
        />
        <Route
          path="/caretaker/appointments"
          element={
            <CaretakerLayout>
              <Appointments />
            </CaretakerLayout>
          }
        />

        {/* Doctor */}
        <Route path="/doctor" element={<DoctorDashboard />} />

        {/* CHO */}
        <Route path="/cho" element={<CHODashboard />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

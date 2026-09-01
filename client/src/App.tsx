import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';

import RequisitionsPage from './pages/RequisitionsPage';
import RequisitionFormPage from './pages/RequisitionFormPage';
import RequisitionDetailPage from './pages/RequisitionDetailPage';
import ApproverQueuePage from './pages/ApproverQueuePage';
import AlertsPage from './pages/AlertsPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected routes */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<HomePage />} />
            <Route path="/requisitions" element={<RequisitionsPage />} />
            <Route path="/requisitions/new" element={<RequisitionFormPage />} />
            <Route path="/requisitions/:id" element={<RequisitionDetailPage />} />
            <Route path="/requisitions/:id/edit" element={<RequisitionFormPage />} />
            <Route path="/queues/submitted" element={<ApproverQueuePage />} />
            <Route path="/queues/assigned" element={<ApproverQueuePage assignedOnly />} />
            <Route path="/alerts" element={<AlertsPage />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

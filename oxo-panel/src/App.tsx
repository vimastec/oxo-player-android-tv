import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';

// Admin pages
import { AdminDashboardPage } from './pages/admin/DashboardPage';
import { ResellersPage } from './pages/admin/ResellersPage';
import { AdminDevicesPage } from './pages/admin/DevicesPage';
import { AdminTransactionsPage } from './pages/admin/TransactionsPage';
import { SellerContactsPage } from './pages/admin/SellerContactsPage';
import { SellerRequestsPage } from './pages/admin/SellerRequestsPage';
import { AppVersionsPage } from './pages/admin/AppVersionsPage';
import { HostsPage } from './pages/admin/HostsPage';

// Reseller pages
import { ResellerDashboardPage } from './pages/reseller/DashboardPage';
import { ResellerDevicesPage } from './pages/reseller/DevicesPage';
import { PlaylistsPage } from './pages/reseller/PlaylistsPage';
import { ActivatePage } from './pages/reseller/ActivatePage';
import { ResellerTransactionsPage } from './pages/reseller/TransactionsPage';
import { SubResellersPage } from './pages/reseller/SubResellersPage';

function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles: string[];
}) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user && !allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/reseller'} replace />;
  }

  return <Layout>{children}</Layout>;
}

function App() {
  const { isAuthenticated, user } = useAuthStore();

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to={user?.role === 'admin' ? '/admin' : '/reseller'} replace />
            ) : (
              <LoginPage />
            )
          }
        />

        {/* Admin routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/resellers"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <ResellersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/devices"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDevicesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/transactions"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminTransactionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/seller-contacts"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <SellerContactsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/seller-requests"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <SellerRequestsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/app-versions"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AppVersionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/hosts"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <HostsPage />
            </ProtectedRoute>
          }
        />

        {/* Reseller routes */}
        <Route
          path="/reseller"
          element={
            <ProtectedRoute allowedRoles={['reseller']}>
              <ResellerDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reseller/devices"
          element={
            <ProtectedRoute allowedRoles={['reseller']}>
              <ResellerDevicesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reseller/devices/:mac/playlists"
          element={
            <ProtectedRoute allowedRoles={['reseller']}>
              <PlaylistsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reseller/activate"
          element={
            <ProtectedRoute allowedRoles={['reseller']}>
              <ActivatePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reseller/transactions"
          element={
            <ProtectedRoute allowedRoles={['reseller']}>
              <ResellerTransactionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reseller/subresellers"
          element={
            <ProtectedRoute allowedRoles={['reseller']}>
              <SubResellersPage />
            </ProtectedRoute>
          }
        />

        {/* Default redirect */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

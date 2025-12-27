import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import LoginPage from './pages/LoginPage';
import PlaylistsPage from './pages/PlaylistsPage';
import AddPlaylistPage from './pages/AddPlaylistPage';
import AddXtreamPage from './pages/AddXtreamPage';
import SellersPage from './pages/SellersPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/sellers" element={<SellersPage />} />
        <Route
          path="/playlists"
          element={
            <PrivateRoute>
              <PlaylistsPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/add-playlist"
          element={
            <PrivateRoute>
              <AddPlaylistPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/add-xtream"
          element={
            <PrivateRoute>
              <AddXtreamPage />
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;



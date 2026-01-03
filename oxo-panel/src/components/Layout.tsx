import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Tv,
  History,
  LogOut,
  Menu,
  X,
  CreditCard,
  Store,
  MessageSquare,
  UserPlus,
  Download,
  Server,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { resellerApi } from '../services/api';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [canCreateSubResellers, setCanCreateSubResellers] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const isAdmin = user?.role === 'admin';

  // Check if reseller can create sub-resellers
  useEffect(() => {
    const checkPermissions = async () => {
      if (!isAdmin && user) {
        try {
          const response = await resellerApi.getMe();
          setCanCreateSubResellers(response.data.can_create_subresellers === true);
        } catch (error) {
          console.error('Error checking permissions:', error);
        }
      }
    };
    checkPermissions();
  }, [isAdmin, user]);

  const adminNavItems = [
    { path: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/admin/resellers', icon: Users, label: 'Revendeurs' },
    { path: '/admin/devices', icon: Tv, label: 'Appareils' },
    { path: '/admin/transactions', icon: History, label: 'Transactions' },
    { path: '/admin/seller-contacts', icon: Store, label: 'Points de vente' },
    { path: '/admin/seller-requests', icon: MessageSquare, label: 'Demandes partenariat' },
    { path: '/admin/hosts', icon: Server, label: 'Hosts Top 10' },
    { path: '/admin/app-versions', icon: Download, label: 'Mise à jour OTA' },
  ];

  const resellerNavItems = [
    { path: '/reseller', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/reseller/devices', icon: Tv, label: 'Mes Appareils' },
    { path: '/reseller/activate', icon: CreditCard, label: 'Activer MAC' },
    ...(canCreateSubResellers ? [{ path: '/reseller/subresellers', icon: UserPlus, label: 'Sous-Revendeurs' }] : []),
    { path: '/reseller/transactions', icon: History, label: 'Historique' },
  ];

  const navItems = isAdmin ? adminNavItems : resellerNavItems;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex">
      {/* Mobile menu button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-card rounded-xl border border-border"
      >
        {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:sticky top-0 left-0 h-screen w-64 z-40
          bg-dark border-r border-border
          transition-transform duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <span className="text-lg font-bold">OXO</span>
              </div>
              <div>
                <h1 className="font-bold">OXO Panel</h1>
                <p className="text-xs text-muted capitalize">{user?.role}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-xl transition-colors
                    ${isActive
                      ? 'bg-primary text-white'
                      : 'text-muted hover:bg-card hover:text-white'
                    }
                  `}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User info */}
          <div className="p-4 border-t border-border">
            <div className="px-4 py-3 bg-card rounded-xl mb-3">
              <p className="font-medium truncate">{user?.name}</p>
              <p className="text-xs text-muted truncate">{user?.email}</p>
              {user?.role === 'reseller' && user?.credits !== undefined && (
                <p className="text-sm text-primary mt-1">
                  {user.credits} crédits
                </p>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-error hover:bg-error/10 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Déconnexion</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 lg:ml-0 min-h-screen">
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}





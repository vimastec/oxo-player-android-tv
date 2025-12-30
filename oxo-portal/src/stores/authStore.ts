import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  isAuthenticated: boolean;
  macAddress: string | null;
  deviceKey: string | null;
  status: string | null;
  expirationDate: string | null;
  
  login: (macAddress: string, deviceKey: string, status: string, expirationDate: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      macAddress: null,
      deviceKey: null,
      status: null,
      expirationDate: null,

      login: (macAddress, deviceKey, status, expirationDate) => {
        set({
          isAuthenticated: true,
          macAddress,
          deviceKey,
          status,
          expirationDate,
        });
      },

      logout: () => {
        set({
          isAuthenticated: false,
          macAddress: null,
          deviceKey: null,
          status: null,
          expirationDate: null,
        });
      },
    }),
    {
      name: 'oxo-portal-auth',
    }
  )
);






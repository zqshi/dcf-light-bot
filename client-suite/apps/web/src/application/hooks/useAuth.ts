import { useAuthStore } from '../stores/authStore';

export function useAuth() {
  const { user, dcfUser, isLoggedIn, isDemo, isBackendConnected } = useAuthStore();
  return { user, dcfUser, isLoggedIn, isDemo, isBackendConnected };
}

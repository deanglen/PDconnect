import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  tenantAccess: string[];
  lastLoginAt?: string;
  createdAt: string;
}

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/users/me"],
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
  };
}

export function logout() {
  // Clear API key from localStorage if stored there
  localStorage.removeItem('apiKey');
  localStorage.removeItem('adminToken');
  
  // Reload the page to clear all state
  window.location.reload();
}

export function getStoredApiKey(): string | null {
  return localStorage.getItem('apiKey') || localStorage.getItem('adminToken');
}

export function setStoredApiKey(apiKey: string) {
  localStorage.setItem('apiKey', apiKey);
}
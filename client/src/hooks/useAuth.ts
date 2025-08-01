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
  profileImageUrl?: string | null;
}

export function useAuth() {
  const hasApiKey = !!(localStorage.getItem('apiKey') || localStorage.getItem('adminToken'));
  
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/users/me"],
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: hasApiKey, // Only query if we have an API key
  });

  return {
    user,
    isLoading: hasApiKey ? isLoading : false, // If no API key, not loading
    isAuthenticated: !!user,
    error,
  };
}

export function logout() {
  // Clear API key from localStorage if stored there
  localStorage.removeItem('apiKey');
  localStorage.removeItem('adminToken');
  
  // Clear any cached query data
  if (typeof window !== 'undefined') {
    window.location.href = '/';
    window.location.reload();
  }
}

export function getStoredApiKey(): string | null {
  return localStorage.getItem('apiKey') || localStorage.getItem('adminToken');
}

export function setStoredApiKey(apiKey: string) {
  localStorage.setItem('apiKey', apiKey);
}
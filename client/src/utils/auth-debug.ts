// Debug utilities for authentication testing
export function clearAuthStorage() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('apiKey');
    localStorage.removeItem('adminToken');
    console.log('Authentication storage cleared');
    window.location.reload();
  }
}

export function setDemoAuth() {
  if (typeof window !== 'undefined') {
    localStorage.setItem('apiKey', 'user_1753977596251_ockbkuys03');
    console.log('Demo authentication set');
    window.location.reload();
  }
}

export function getAuthStatus() {
  if (typeof window !== 'undefined') {
    const apiKey = localStorage.getItem('apiKey');
    const adminToken = localStorage.getItem('adminToken');
    console.log('Auth Status:', {
      hasApiKey: !!apiKey,
      hasAdminToken: !!adminToken,
      apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : null,
      adminToken: adminToken ? `${adminToken.substring(0, 10)}...` : null
    });
    return { apiKey, adminToken };
  }
  return { apiKey: null, adminToken: null };
}

// Make functions available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).authDebug = {
    clearAuth: clearAuthStorage,
    setDemo: setDemoAuth,
    status: getAuthStatus
  };
}
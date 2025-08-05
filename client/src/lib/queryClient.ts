import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorText = res.statusText;
    try {
      const text = await res.text();
      if (text) errorText = text;
    } catch {
      // If we can't read the response text, use status text
    }
    throw new Error(`${res.status}: ${errorText}`);
  }
}

// For production: Use session-based authentication
function getAuthHeaders(): HeadersInit {
  // In production, rely on session cookies for authentication
  // Don't send admin token - use proper session authentication
  return {};
}

export async function apiRequest(
  url: string,
  options: RequestInit = {}
): Promise<any> {
  const headers: HeadersInit = {
    ...getAuthHeaders(),
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...options.headers,
  };

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: "include", // This ensures session cookies are sent
  });

  await throwIfResNotOk(res);
  
  // Return parsed JSON for most requests
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    const text = await res.text();
    if (text.trim() === '') {
      return null; // Handle empty JSON responses
    }
    try {
      return JSON.parse(text);
    } catch (error) {
      console.error('Failed to parse JSON response:', text);
      throw new Error('Invalid JSON response from server');
    }
  }
  
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      headers: getAuthHeaders(),
      credentials: "include", // Session cookies will be sent automatically
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
      throwOnError: false, // Don't throw unhandled errors
    },
    mutations: {
      retry: false,
      throwOnError: false, // Don't throw unhandled errors
    },
  },
});

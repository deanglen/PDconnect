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

// Get stored API key for authentication
function getAuthHeaders(): HeadersInit {
  const apiKey = localStorage.getItem('apiKey') || localStorage.getItem('adminToken');
  
  if (!apiKey) {
    return {};
  }
  
  const headers: HeadersInit = {
    "Authorization": `Bearer ${apiKey}`,
  };
  
  return headers;
}

export async function apiRequest(
  url: string,
  method: string = 'GET',
  data?: unknown | undefined,
): Promise<any> {
  const headers: HeadersInit = {
    ...getAuthHeaders(),
    ...(data ? { "Content-Type": "application/json" } : {}),
  };

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  
  // Return parsed JSON for most requests
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return await res.json();
  }
  
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const authHeaders = getAuthHeaders();
    
    // If no API key is stored, return null for authentication queries
    if (Object.keys(authHeaders).length === 0 && unauthorizedBehavior === "returnNull") {
      return null;
    }
    
    const res = await fetch(queryKey.join("/") as string, {
      headers: authHeaders,
      credentials: "include",
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

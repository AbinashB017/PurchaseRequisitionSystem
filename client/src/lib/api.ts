const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  status: number;
  ok: boolean;
}

/**
 * Centralized API client. All requests include credentials (cookies)
 * for httpOnly JWT auth.
 */
async function request<T = unknown>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<ApiResponse<T>> {
  const { method = 'GET', body, headers = {} } = options;

  const config: RequestInit = {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body && method !== 'GET') {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, config);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        error: data?.error || `Request failed with status ${response.status}`,
        status: response.status,
        ok: false,
      };
    }

    return {
      data: data as T,
      status: response.status,
      ok: true,
    };
  } catch (err) {
    return {
      error: 'Network error. Please check your connection.',
      status: 0,
      ok: false,
    };
  }
}

// Auth API
export const authApi = {
  register: (body: {
    email: string;
    password: string;
    name: string;
    role: 'requester' | 'approver';
    approval_limit?: number;
  }) => request('/api/auth/register', { method: 'POST', body }),

  login: (body: { email: string; password: string }) =>
    request('/api/auth/login', { method: 'POST', body }),

  logout: () => request('/api/auth/logout', { method: 'POST' }),

  me: () => request('/api/auth/me'),
};

export default request;

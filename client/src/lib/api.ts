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

export const requisitionApi = {
  /** Server-side search/filter/sort/paginate. Returns { data, meta } */
  list: (params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/requisitions${qs ? '?' + qs : ''}`);
  },
  getRequisition: (id: string) => request(`/api/requisitions/${id}`),
  create: (body: any) => request('/api/requisitions', { method: 'POST', body }),
  update: (id: string, body: any) => request(`/api/requisitions/${id}`, { method: 'PUT', body }),
  addLineItem: (id: string, body: any) => request(`/api/requisitions/${id}/lines`, { method: 'POST', body }),
  updateLineItem: (id: string, lineId: string, body: any) => request(`/api/requisitions/${id}/lines/${lineId}`, { method: 'PUT', body }),
  removeLineItem: (id: string, lineId: string) => request(`/api/requisitions/${id}/lines/${lineId}`, { method: 'DELETE' }),

  // Lifecycle actions
  submit: (id: string) => request(`/api/requisitions/${id}/submit`, { method: 'POST' }),
  archive: (id: string) => request(`/api/requisitions/${id}/archive`, { method: 'POST' }),
  restore: (id: string) => request(`/api/requisitions/${id}/restore`, { method: 'POST' }),
  approve: (id: string) => request(`/api/requisitions/${id}/approve`, { method: 'POST' }),
  reject: (id: string, reason: string) => request(`/api/requisitions/${id}/reject`, { method: 'POST', body: { reason } }),
  order: (id: string) => request(`/api/requisitions/${id}/order`, { method: 'POST' }),
  extendNeededBy: (id: string, needed_by_date: string) => request(`/api/requisitions/${id}/extend-needed-by`, { method: 'POST', body: { needed_by_date } }),
  receive: (id: string, line_item_id: string, received_quantity: number) => request(`/api/requisitions/${id}/receive`, { method: 'POST', body: { line_item_id, received_quantity } }),

  // Comments & Timeline
  addComment: (id: string, comment: string) => request(`/api/requisitions/${id}/comments`, { method: 'POST', body: { comment } }),
  getAuditEvents: (id: string) => request(`/api/requisitions/${id}/audit-events`),

  // Approver assignments
  getApprovers: (id: string) => request(`/api/requisitions/${id}/approvers`),
  addApprover: (id: string, approver_id: string) => request(`/api/requisitions/${id}/approvers`, { method: 'POST', body: { approver_id } }),
  removeApprover: (id: string, approverId: string) => request(`/api/requisitions/${id}/approvers/${approverId}`, { method: 'DELETE' }),
};

export const queueApi = {
  /** Paginated submitted queue */
  getSubmittedQueue: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/queues/submitted${qs ? '?' + qs : ''}`);
  },
  /** Paginated assigned-to-me queue */
  getAssignedToMe: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/queues/assigned-to-me${qs ? '?' + qs : ''}`);
  },
  /** Bulk approve: returns { approved, refused, summary } */
  bulkApprove: (ids: string[]) => request('/api/bulk-approve', { method: 'POST', body: { ids } }),
  /** CSV export URL (direct browser download) */
  exportOrderedCsvUrl: () => `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/export/ordered.csv`,
};

export const dashboardApi = {
  getDashboard: () => request('/api/dashboard'),
  getAlerts: () => request('/api/alerts'),
  getAlertCount: () => request('/api/alerts/count'),
  dismiss: (requisitionId: string) =>
    request(`/api/alerts/${requisitionId}/dismiss`, { method: 'POST' }),
};

export const userApi = {
  /** Returns all approver users (for assignment dropdown) */
  listApprovers: () => request('/api/auth/approvers'),
};

export default request;


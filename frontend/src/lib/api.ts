const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://e942-103-224-73-153.ngrok-free.app/api';

const getHeaders = () => {
  const headers: HeadersInit = {
    'Accept': 'application/json',
    'ngrok-skip-browser-warning': '69420',
  };

  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('snapjoy_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  return headers;
};

const getAuthToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('snapjoy_token');
  }
  return null;
};

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  const headers = {
    ...getHeaders(),
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      // Token expired or invalid - clear it and redirect to auth
      if (typeof window !== 'undefined') {
        localStorage.removeItem('snapjoy_token');
        // Hapus cookie dengan menset expiry date ke masa lalu
        document.cookie = 'snapjoy_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Lax; Secure';
        window.location.href = '/auth';
      }
      throw new Error('Session expired. Please login again.');
    }

    let errorMessage = 'An error occurred';
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
      
      // Handle Laravel validation errors
      if (errorData.errors) {
        const firstError = Object.values(errorData.errors)[0];
        if (Array.isArray(firstError) && firstError.length > 0) {
          errorMessage = firstError[0] as string;
        }
      }
    } catch (_) {
      errorMessage = `Request failed with status ${response.status}`;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

// Authentication API
export const authApi = {
  register: (data: any) => apiRequest('/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }),

  login: (data: any) => apiRequest('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }),

  logout: () => apiRequest('/logout', {
    method: 'POST',
  }),

  me: () => apiRequest('/user'),

  updateProfile: (data: { name?: string; email?: string; current_password?: string; password?: string; password_confirmation?: string }) =>
    apiRequest('/user/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
};

// Frames API
export const framesApi = {
  list: () => apiRequest('/frames'),
  
  upload: (formData: FormData) => apiRequest('/frames', {
    method: 'POST',
    body: formData, // boundary and content-type set automatically by browser
  }),

  delete: (id: number) => apiRequest(`/frames/${id}`, {
    method: 'DELETE',
  }),
};

// Frame Templates API
export const frameTemplatesApi = {
  list: () => apiRequest('/frame-templates'),
  
  get: (id: number | string) => apiRequest(`/frame-templates/${id}`),

  create: (formData: FormData) => apiRequest('/frame-templates', {
    method: 'POST',
    body: formData,
  }),

  update: (id: number | string, formData: FormData) => apiRequest(`/frame-templates/${id}`, {
    method: 'POST',
    body: formData,
  }),

  toggleActive: (id: number | string) => apiRequest(`/admin/frame-templates/${id}/toggle-active`, {
    method: 'PATCH',
  }),

  delete: (id: number | string) => apiRequest(`/frame-templates/${id}`, {
    method: 'DELETE',
  }),
};

// Photo Sessions API
export const sessionsApi = {
  create: (frameId?: number) => apiRequest('/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ frame_id: frameId }),
  }),

  uploadPhoto: (sessionId: number, slotIndex: number, photoBlob: Blob) => {
    const formData = new FormData();
    formData.append('photo', photoBlob, `slot_${slotIndex}.png`);
    formData.append('slot_index', slotIndex.toString());

    return apiRequest(`/sessions/${sessionId}/photos`, {
      method: 'POST',
      body: formData,
    });
  },

  complete: (sessionId: number, frameId?: number, finalStripBlob?: Blob) => {
    if (finalStripBlob) {
      const formData = new FormData();
      formData.append('final_strip', finalStripBlob, 'final_strip.jpg');
      if (frameId) {
        formData.append('frame_id', frameId.toString());
      }
      return apiRequest(`/sessions/${sessionId}/complete`, {
        method: 'POST',
        body: formData,
      });
    }

    return apiRequest(`/sessions/${sessionId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: frameId ? JSON.stringify({ frame_id: frameId }) : undefined,
    });
  },

  get: (sessionId: string | number) => apiRequest(`/sessions/${sessionId}`),

  listMySessions: () => apiRequest('/my-sessions'),
  
  delete: (sessionId: number) => apiRequest(`/sessions/${sessionId}`, {
    method: 'DELETE',
  }),

  pay: (sessionId: number | string, returnUrl?: string, frameId?: number) => apiRequest(`/sessions/${sessionId}/pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ return_url: returnUrl, frame_id: frameId }),
  }),

  paymentStatus: (sessionId: number | string) => apiRequest(`/sessions/${sessionId}/payment-status`),
};

// Settings API (public & legacy)
export const settingsApi = {
  getPublic: () => apiRequest('/settings/public'),
  
  getPaymentku: () => apiRequest('/admin/settings/paymentku'),
  savePaymentku: (data: { paymentku_api_key: string; webhook_token: string }) => apiRequest('/admin/settings/paymentku', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }),
};

// Admin API
export const adminApi = {
  // Dashboard stats
  getStats: () => apiRequest('/admin/stats'),

  // User management
  getUsers: (params?: { page?: number; search?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.search) searchParams.set('search', params.search);
    const qs = searchParams.toString();
    return apiRequest(`/admin/users${qs ? `?${qs}` : ''}`);
  },

  updateUserRole: (userId: number, role: string) => apiRequest(`/admin/users/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  }),

  // Transactions
  getTransactions: (params?: { page?: number; payment_status?: string; status?: string; search?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.payment_status) searchParams.set('payment_status', params.payment_status);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.search) searchParams.set('search', params.search);
    const qs = searchParams.toString();
    return apiRequest(`/admin/transactions${qs ? `?${qs}` : ''}`);
  },

  // Payment settings
  getPaymentSettings: () => apiRequest('/admin/settings/payment'),
  setPaymentSettings: (data: { payment_enabled?: boolean; session_price?: number; service_fee?: number }) => apiRequest('/admin/settings/payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }),

  // Paymentku API keys (moved from settingsApi)
  getPaymentkuSettings: () => apiRequest('/admin/settings/paymentku'),
  savePaymentkuSettings: (data: { paymentku_api_key: string; webhook_token: string }) => apiRequest('/admin/settings/paymentku', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }),
};

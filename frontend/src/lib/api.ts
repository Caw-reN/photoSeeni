const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://a035-160-22-192-46.ngrok-free.app/api';

const getHeaders = () => {
  const headers: HeadersInit = {
    'Accept': 'application/json',
    'ngrok-skip-browser-warning': '69420',
  };

  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('fotoseeni_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  return headers;
};

const getAuthToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('fotoseeni_token');
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
        localStorage.removeItem('fotoseeni_token');
        // Hapus cookie dengan menset expiry date ke masa lalu
        document.cookie = 'fotoseeni_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Lax; Secure';
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

  toggleBw: (id: number | string) => apiRequest(`/admin/frame-templates/${id}/toggle-bw`, {
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

  complete: (sessionId: number, frameId?: number, finalStripBlobs?: Blob | Blob[], gifSpeed?: number) => {
    if (finalStripBlobs) {
      const formData = new FormData();
      if (Array.isArray(finalStripBlobs)) {
        finalStripBlobs.forEach((blob, index) => {
          formData.append('final_strips[]', blob, `final_strip_${index}.jpg`);
        });
      } else {
        formData.append('final_strip', finalStripBlobs, 'final_strip.jpg');
      }
      if (frameId) {
        formData.append('frame_id', frameId.toString());
      }
      if (gifSpeed) {
        formData.append('gif_speed', gifSpeed.toString());
      }
      return apiRequest(`/sessions/${sessionId}/complete`, {
        method: 'POST',
        body: formData,
      });
    }

    return apiRequest(`/sessions/${sessionId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        frame_id: frameId,
        gif_speed: gifSpeed,
      }),
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

// ─────────────────────────────────────────────
// Events API
// ─────────────────────────────────────────────
export const eventsApi = {
  // Public: get event info + packages by slug
  getEvent: (slug: string) => apiRequest(`/events/${slug}`),
  getPackages: (slug: string) => apiRequest(`/events/${slug}/packages`),

  // Public: purchase a package → get QRIS + redeem code
  purchase: (slug: string, data: {
    event_package_id: number;
    buyer_name: string;
    buyer_email?: string;
    buyer_phone?: string;
    return_url?: string;
  }) => apiRequest(`/events/${slug}/purchase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }),

  // Public: poll payment status for a redeem code purchase
  checkPurchaseStatus: (code: string) => apiRequest('/events/redeem/payment-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  }),

  // Public: validate redeem code
  validateCode: (code: string) => apiRequest('/events/redeem/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  }),

  // Public: start a photoshoot session with a valid code
  startSession: (code: string, data?: { buyer_name?: string; buyer_email?: string; buyer_phone?: string }) => apiRequest('/events/redeem/start-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, ...data }),
  }),

  // Public: get photo result by redeem code
  getResult: (code: string) => apiRequest(`/events/redeem/${code}/result`),

  // ── Admin ──
  adminListEvents: (params?: { page?: number; search?: string; is_active?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', params.page.toString());
    if (params?.search) qs.set('search', params.search);
    if (params?.is_active !== undefined) qs.set('is_active', params.is_active ? '1' : '0');
    return apiRequest(`/admin/events${qs.toString() ? `?${qs}` : ''}`);
  },

  adminCreateEvent: (data: {
    name: string;
    organizer_name: string;
    description?: string;
    location?: string;
    event_date?: string;
    frame_template_id?: number | null;
    frame_template_ids?: number[];
    is_active?: boolean;
    expires_at?: string | null;
  }) => apiRequest('/admin/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }),

  adminUpdateEvent: (eventId: number, data: Partial<{
    name: string;
    organizer_name: string;
    description: string;
    location: string;
    event_date: string;
    frame_template_id: number | null;
    frame_template_ids: number[];
    is_active: boolean;
    expires_at: string | null;
  }>) => apiRequest(`/admin/events/${eventId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }),

  adminSyncFrames: (eventId: number, frameTemplateIds: number[]) => apiRequest(`/admin/events/${eventId}/sync-frames`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ frame_template_ids: frameTemplateIds }),
  }),

  adminDeleteEvent: (eventId: number) => apiRequest(`/admin/events/${eventId}`, {
    method: 'DELETE',
  }),

  adminGetEvent: (eventId: number) => apiRequest(`/admin/events/${eventId}`),
  adminGetEventStats: (eventId: number) => apiRequest(`/admin/events/${eventId}/stats`),

  // Admin packages
  adminCreatePackage: (eventId: number, data: {
    name: string;
    description?: string;
    price: number;
    photo_count: number;
    sort_order?: number;
    session_duration?: number;
    print_count?: number;
  }) => apiRequest(`/admin/events/${eventId}/packages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }),

  adminUpdatePackage: (eventId: number, packageId: number, data: Partial<{
    name: string;
    description: string;
    price: number;
    photo_count: number;
    sort_order: number;
    session_duration: number;
    print_count: number;
  }>) => apiRequest(`/admin/events/${eventId}/packages/${packageId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }),

  adminDeletePackage: (eventId: number, packageId: number) =>
    apiRequest(`/admin/events/${eventId}/packages/${packageId}`, { method: 'DELETE' }),

  // Admin redeem codes list
  adminListRedeemCodes: (eventId: number, params?: {
    page?: number;
    payment_status?: string;
    is_used?: boolean;
    search?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', params.page.toString());
    if (params?.payment_status) qs.set('payment_status', params.payment_status);
    if (params?.is_used !== undefined) qs.set('is_used', params.is_used ? '1' : '0');
    if (params?.search) qs.set('search', params.search);
    return apiRequest(`/admin/events/${eventId}/redeem-codes${qs.toString() ? `?${qs}` : ''}`);
  },

  adminCreateRedeemCodes: (eventId: number, data: {
    event_package_id: number;
    buyer_name?: string;
    buyer_email?: string;
    buyer_phone?: string;
    quantity: number;
    payment_status: 'paid' | 'unpaid' | 'pending';
  }) => apiRequest(`/admin/events/${eventId}/redeem-codes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }),

  adminMarkRedeemCodePaid: (eventId: number, redeemCodeId: number) =>
    apiRequest(`/admin/events/${eventId}/redeem-codes/${redeemCodeId}/mark-paid`, {
      method: 'PATCH',
    }),

  adminDeleteRedeemCode: (eventId: number, redeemCodeId: number) =>
    apiRequest(`/admin/events/${eventId}/redeem-codes/${redeemCodeId}`, {
      method: 'DELETE',
    }),
};


import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

const CEO_BASE = '/api/v1/super-admin';

// ─── Token helpers ───────────────────────────────────────────────────────────
const getToken  = () => localStorage.getItem('ceo_access');
const authHdr   = () => ({ Authorization: `Bearer ${getToken()}` });
const jsonHdrs  = () => ({ ...authHdr(), 'Content-Type': 'application/json' });

// ─── Async Thunks ────────────────────────────────────────────────────────────

export const ceoLogin = createAsyncThunk('ceo/login', async ({ email, password }, { rejectWithValue }) => {
  try {
    const res = await fetch(`${CEO_BASE}/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login xatoligi');
    localStorage.setItem('ceo_access',  data.access);
    localStorage.setItem('ceo_refresh', data.refresh);
    return data;
  } catch (e) { return rejectWithValue(e.message); }
});

export const fetchAnalytics = createAsyncThunk('ceo/analytics', async (_, { rejectWithValue }) => {
  try {
    const res  = await fetch(`${CEO_BASE}/analytics/`, { headers: authHdr() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Analytics xatoligi');
    return data;
  } catch (e) { return rejectWithValue(e.message); }
});

export const fetchTenants = createAsyncThunk('ceo/tenants', async (params = {}, { rejectWithValue }) => {
  try {
    const qs  = new URLSearchParams(params).toString();
    const res = await fetch(`${CEO_BASE}/tenants/?${qs}`, { headers: authHdr() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Tenantlar xatoligi');
    return data;
  } catch (e) { return rejectWithValue(e.message); }
});

export const fetchTenantDetail = createAsyncThunk('ceo/tenantDetail', async (id, { rejectWithValue }) => {
  try {
    const res  = await fetch(`${CEO_BASE}/tenants/${id}/`, { headers: authHdr() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Tenant topilmadi');
    return data;
  } catch (e) { return rejectWithValue(e.message); }
});

export const createTenant = createAsyncThunk('ceo/createTenant', async (payload, { rejectWithValue }) => {
  try {
    const res  = await fetch(`${CEO_BASE}/tenants/`, {
      method: 'POST', headers: jsonHdrs(), body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));
    return data;
  } catch (e) { return rejectWithValue(e.message); }
});

export const toggleTenantStatus = createAsyncThunk('ceo/toggleStatus',
  async ({ id, is_active, reason = '' }, { rejectWithValue }) => {
    try {
      const res  = await fetch(`${CEO_BASE}/tenants/${id}/toggle-status/`, {
        method: 'PATCH', headers: jsonHdrs(),
        body: JSON.stringify({ is_active, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Status o\'zgartirish xatoligi');
      return { id, is_active, ...data };
    } catch (e) { return rejectWithValue(e.message); }
  }
);

export const updateTenant = createAsyncThunk('ceo/updateTenant',
  async ({ id, ...data }, { rejectWithValue }) => {
    try {
      const res = await fetch(`${CEO_BASE}/tenants/${id}/`, {
        method: 'PATCH',
        headers: jsonHdrs(),
        body: JSON.stringify(data),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Markazni yangilashda xatolik');
      return resData;
    } catch (e) { return rejectWithValue(e.message); }
  }
);

export const resetAdminPassword = createAsyncThunk('ceo/resetAdminPassword',
  async ({ id, new_password }, { rejectWithValue }) => {
    try {
      const res = await fetch(`${CEO_BASE}/tenants/${id}/reset-admin-password/`, {
        method: 'POST',
        headers: jsonHdrs(),
        body: JSON.stringify({ new_password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Parolni yangilashda xatolik');
      return data;
    } catch (e) { return rejectWithValue(e.message); }
  }
);

export const updateAdmin = createAsyncThunk('ceo/updateAdmin',
  async ({ id, ...data }, { rejectWithValue }) => {
    try {
      const res = await fetch(`${CEO_BASE}/tenants/${id}/update-admin/`, {
        method: 'PATCH',
        headers: jsonHdrs(),
        body: JSON.stringify(data),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Adminni yangilashda xatolik');
      return resData;
    } catch (e) { return rejectWithValue(e.message); }
  }
);

export const impersonateTenant = createAsyncThunk('ceo/impersonateTenant',
  async (tenantId, { rejectWithValue }) => {
    try {
      const res = await fetch(`${CEO_BASE}/tenants/${tenantId}/impersonate/`, {
        method: 'POST',
        headers: jsonHdrs(),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Tizimga kirishda xatolik yuz berdi');
      return resData;
    } catch (e) { return rejectWithValue(e.message); }
  }
);

// ─── Slice ───────────────────────────────────────────────────────────────────

const ceoSlice = createSlice({
  name: 'ceo',
  initialState: {
    // Auth
    user:          JSON.parse(localStorage.getItem('ceo_user') || 'null'),
    isAuthenticated: !!localStorage.getItem('ceo_access'),
    authLoading:   false,
    authError:     null,

    // Analytics
    analytics:     null,
    analyticsLoading: false,

    // Tenants
    tenants:       [],
    tenantsTotal:  0,
    tenantsPage:   1,
    tenantsPages:  1,
    tenantsLoading: false,
    tenantsError:  null,

    // Tenant Detail
    selectedTenant: null,
    detailLoading:  false,

    // Create
    createLoading:  false,
    createError:    null,
    createSuccess:  false,
  },

  reducers: {
    ceoLogout(state) {
      state.isAuthenticated = false;
      state.user            = null;
      state.analytics       = null;
      state.tenants         = [];
      localStorage.removeItem('ceo_access');
      localStorage.removeItem('ceo_refresh');
      localStorage.removeItem('ceo_user');
    },
    clearCreateState(state) {
      state.createError   = null;
      state.createSuccess = false;
    },
    clearSelectedTenant(state) {
      state.selectedTenant = null;
    },
  },

  extraReducers: (builder) => {
    // Login
    builder
      .addCase(ceoLogin.pending,    (s) => { s.authLoading = true;  s.authError = null; })
      .addCase(ceoLogin.fulfilled,  (s, { payload }) => {
        s.authLoading     = false;
        s.isAuthenticated = true;
        s.user            = payload.user;
        localStorage.setItem('ceo_user', JSON.stringify(payload.user));
      })
      .addCase(ceoLogin.rejected,   (s, { payload }) => { s.authLoading = false; s.authError = payload; });

    // Analytics
    builder
      .addCase(fetchAnalytics.pending,   (s) => { s.analyticsLoading = true; })
      .addCase(fetchAnalytics.fulfilled, (s, { payload }) => { s.analyticsLoading = false; s.analytics = payload; })
      .addCase(fetchAnalytics.rejected,  (s) => { s.analyticsLoading = false; });

    // Tenants list
    builder
      .addCase(fetchTenants.pending,   (s) => { s.tenantsLoading = true; s.tenantsError = null; })
      .addCase(fetchTenants.fulfilled, (s, { payload }) => {
        s.tenantsLoading = false;
        s.tenants        = payload.results;
        s.tenantsTotal   = payload.count;
        s.tenantsPage    = payload.page;
        s.tenantsPages   = payload.pages;
      })
      .addCase(fetchTenants.rejected,  (s, { payload }) => { s.tenantsLoading = false; s.tenantsError = payload; });

    // Tenant detail
    builder
      .addCase(fetchTenantDetail.pending,   (s) => { s.detailLoading = true; })
      .addCase(fetchTenantDetail.fulfilled, (s, { payload }) => { s.detailLoading = false; s.selectedTenant = payload; })
      .addCase(fetchTenantDetail.rejected,  (s) => { s.detailLoading = false; });

    // Create
    builder
      .addCase(createTenant.pending,   (s) => { s.createLoading = true; s.createError = null; s.createSuccess = false; })
      .addCase(createTenant.fulfilled, (s, { payload }) => {
        s.createLoading = false;
        s.createSuccess = true;
        s.tenants.unshift(payload.tenant);
        s.tenantsTotal++;
      })
      .addCase(createTenant.rejected,  (s, { payload }) => { s.createLoading = false; s.createError = payload; });

    // Toggle status
    builder
      .addCase(toggleTenantStatus.fulfilled, (s, { payload }) => {
        const idx = s.tenants.findIndex((t) => t.id === payload.id);
        if (idx !== -1) s.tenants[idx].is_active = payload.is_active;
        if (s.selectedTenant?.id === payload.id) s.selectedTenant.is_active = payload.is_active;
      });

    // Update tenant
    builder
      .addCase(updateTenant.fulfilled, (s, { payload }) => {
        s.selectedTenant = payload;
        const idx = s.tenants.findIndex((t) => t.id === payload.id);
        if (idx !== -1) s.tenants[idx] = { ...s.tenants[idx], ...payload };
      });

    // Update admin
    builder
      .addCase(updateAdmin.fulfilled, (s, { payload }) => {
        if (s.selectedTenant && payload.super_admin) {
          s.selectedTenant.super_admin = payload.super_admin;
        }
      });
  },
});

export const { ceoLogout, clearCreateState, clearSelectedTenant } = ceoSlice.actions;
export default ceoSlice.reducer;

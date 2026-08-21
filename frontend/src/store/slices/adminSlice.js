import { createSlice, createAsyncThunk } from'@reduxjs/toolkit';
import api from'../../tokenUpdater/updater';

export const fetchAdminMe = createAsyncThunk(
'admin/fetchMe',
 async (_, { rejectWithValue }) => {
 try {
 const response = await api.get('/user/me/');
 return response.data;
 } catch (error) {
 return rejectWithValue(error.response?.data ||'Xatolik yuz berdi');
 }
 }
);

const adminSlice = createSlice({
 name:'admin',
 initialState: {
 user: {},
 hasPermission: false,
 loading: false,
 error: null,
 isAfterSix: false,
 isNotificationOpen: false,
 isDownloading: false,
 },
 reducers: {
 setAfterSix: (state, action) => {
 state.isAfterSix = action.payload;
 },
 toggleNotification: (state) => {
 state.isNotificationOpen = !state.isNotificationOpen;
 },
 setNotificationOpen: (state, action) => {
 state.isNotificationOpen = action.payload;
 },
 setDownloading: (state, action) => {
 state.isDownloading = action.payload;
 }
 },
 extraReducers: (builder) => {
 builder
 .addCase(fetchAdminMe.pending, (state) => {
 state.loading = true;
 })
 .addCase(fetchAdminMe.fulfilled, (state, action) => {
 state.loading = false;
 state.user = action.payload;
 const perms = action.payload.permissions || {};
 const isSuperAdmin = action.payload.role ==='super_admin' || action.payload.is_superuser;
 state.hasPermission = !!perms.reports || isSuperAdmin;
 })
 .addCase(fetchAdminMe.rejected, (state, action) => {
 state.loading = false;
 state.error = action.payload;
 });
 },
});

export const { setAfterSix, toggleNotification, setNotificationOpen, setDownloading } = adminSlice.actions;
export default adminSlice.reducer;

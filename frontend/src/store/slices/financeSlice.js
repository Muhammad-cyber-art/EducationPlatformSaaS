import { createSlice } from'@reduxjs/toolkit';

const initialState = {
 data: null,
 selfData: null,
 loading: true,
 recalculating: false,
 payModal: false,
 selectedHistoryItem: null,
 editModal: false,
 editLoading: false,
 editForm: {
 fixed_salary:"",
 commission_percentage:"",
 per_student_amount:"",
 salary_type:"fixed",
 karta:""
 },
 // Mentor Group Salary Config states
 groupConfigModal: false,
 groupConfigs: [],
 groupConfigsLoading: false,
 groupConfigForm: {
    group: "",
    salary_type: "percentage",
    commission_percentage: "",
    per_student_amount: ""
 },
 // StaffProfileForm states
 profileFormLoading: false,
 profileUsers: [],
 profileExisting: [],
 profileUsersLoading: false,
 profileError:'',
 profileSuccess: false,
 profileSelectedRole:'admin',
 profileSalaryType:'fixed',
 profileFormData: {
 user:'',
 salary_type:'fixed',
 fixed_salary:'',
 commission_percentage:'',
 per_student_amount:'',
 karta:''
 },
 // StaffPayments states
 activeBranch: localStorage.getItem("activeBID") || null,
 activeTab: localStorage.getItem("staffPaymentsActiveTab") || "admin",
 addStaffModal: false,
 branches: [],
 staffData: [],
 staffSearchQuery:"",
 staffRefreshing: false,
 staffLoading: false,
 // Progressive KPI loading
 kpiLoading: false,
 kpiData: null,
};

const financeSlice = createSlice({
 name:'finance',
 initialState,
 reducers: {
 setData: (state, action) => {
 state.data = action.payload;
 },
 setSelfData: (state, action) => {
 state.selfData = action.payload;
 },
 setLoading: (state, action) => {
 state.loading = action.payload;
 },
 setRecalculating: (state, action) => {
 state.recalculating = action.payload;
 },
 setPayModal: (state, action) => {
 state.payModal = action.payload;
 },
 setSelectedHistoryItem: (state, action) => {
 state.selectedHistoryItem = action.payload;
 },
 setEditModal: (state, action) => {
 state.editModal = action.payload;
 },
 setEditLoading: (state, action) => {
 state.editLoading = action.payload;
 },
 setEditForm: (state, action) => {
 state.editForm = action.payload;
 },
 updateEditForm: (state, action) => {
 state.editForm = { ...state.editForm, ...action.payload };
 },
 // Mentor Group Salary Config actions
 setGroupConfigModal: (state, action) => {
 state.groupConfigModal = action.payload;
 },
 setGroupConfigs: (state, action) => {
 state.groupConfigs = action.payload;
 },
 setGroupConfigsLoading: (state, action) => {
 state.groupConfigsLoading = action.payload;
 },
 setGroupConfigForm: (state, action) => {
 state.groupConfigForm = action.payload;
 },
 updateGroupConfigForm: (state, action) => {
 state.groupConfigForm = { ...state.groupConfigForm, ...action.payload };
 },
 resetGroupConfigForm: (state) => {
 state.groupConfigForm = initialState.groupConfigForm;
 },
 // Profile Form Actions
 setProfileFormLoading: (state, action) => { state.profileFormLoading = action.payload; },
 setProfileUsers: (state, action) => { state.profileUsers = action.payload; },
 setProfileExisting: (state, action) => { state.profileExisting = action.payload; },
 setProfileUsersLoading: (state, action) => { state.profileUsersLoading = action.payload; },
 setProfileError: (state, action) => { state.profileError = action.payload; },
 setProfileSuccess: (state, action) => { state.profileSuccess = action.payload; },
 setProfileSelectedRole: (state, action) => { state.profileSelectedRole = action.payload; },
 setProfileSalaryType: (state, action) => { state.profileSalaryType = action.payload; },
 updateProfileFormData: (state, action) => {
 state.profileFormData = { ...state.profileFormData, ...action.payload };
 },
 resetProfileForm: (state) => {
 state.profileFormData = initialState.profileFormData;
 state.profileSelectedRole ='admin';
 state.profileSalaryType ='fixed';
 state.profileError ='';
 state.profileSuccess = false;
 },
 setActiveBranch: (state, action) => {
 state.activeBranch = action.payload;
 localStorage.setItem("activeBID", action.payload);
 },
 setActiveTab: (state, action) => {
 state.activeTab = action.payload;
 localStorage.setItem("staffPaymentsActiveTab", action.payload);
 },
 setAddStaffModal: (state, action) => {
 state.addStaffModal = action.payload;
 },
 setBranches: (state, action) => {
 state.branches = action.payload;
 },
 setStaffData: (state, action) => {
 state.staffData = action.payload;
 },
 setStaffSearchQuery: (state, action) => {
 state.staffSearchQuery = action.payload;
 },
 setStaffRefreshing: (state, action) => {
 state.staffRefreshing = action.payload;
 },
 setStaffLoading: (state, action) => {
 state.staffLoading = action.payload;
 },
 setKpiLoading: (state, action) => {
 state.kpiLoading = action.payload;
 },
 setKpiData: (state, action) => {
 state.kpiData = action.payload;
 },
    resetFinanceState: (state) => {
        const preservedState = {
            activeBranch: state.activeBranch,
            activeTab: state.activeTab,
            branches: state.branches,
        };
        return { ...initialState, ...preservedState };
    }
 }
});

export const {
 setData,
 setSelfData,
 setLoading,
 setRecalculating,
 setPayModal,
 setSelectedHistoryItem,
 setEditModal,
 setEditLoading,
 setEditForm,
 updateEditForm,
 // Mentor Group Salary Config actions
 setGroupConfigModal,
 setGroupConfigs,
 setGroupConfigsLoading,
 setGroupConfigForm,
 updateGroupConfigForm,
 resetGroupConfigForm,
 setProfileFormLoading,
 setProfileUsers,
 setProfileExisting,
 setProfileUsersLoading,
 setProfileError,
 setProfileSuccess,
 setProfileSelectedRole,
 setProfileSalaryType,
 updateProfileFormData,
 resetProfileForm,
 setActiveBranch,
 setActiveTab,
 setAddStaffModal,
 setBranches,
 setStaffData,
 setStaffSearchQuery,
 setStaffRefreshing,
 setStaffLoading,
 setKpiLoading,
 setKpiData,
 resetFinanceState
} = financeSlice.actions;


export default financeSlice.reducer;

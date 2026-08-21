import { createSlice } from'@reduxjs/toolkit';

const initialState = {
 activeBranchId: null,
 activeBranchName:'',
 searchQuery:'',
 activeTab:'all',
};

const mentorSlice = createSlice({
 name:'mentor',
 initialState,
 reducers: {
 setBranch: (state, action) => {
 state.activeBranchId = action.payload.id;
 state.activeBranchName = action.payload.name;
 },
 setSearchQuery: (state, action) => {
 state.searchQuery = action.payload;
 },
 setTab: (state, action) => {
 state.activeTab = action.payload;
 },
 },
});

export const { setBranch, setSearchQuery, setTab } = mentorSlice.actions;
export default mentorSlice.reducer;

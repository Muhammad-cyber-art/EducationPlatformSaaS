import { configureStore } from '@reduxjs/toolkit';
import mentorReducer from './slices/mentorSlice';
import financeReducer from './slices/financeSlice';
import adminReducer from './slices/adminSlice';
import ceoReducer from './slices/ceoSlice';

export const store = configureStore({
  reducer: {
    mentor:  mentorReducer,
    finance: financeReducer,
    admin:   adminReducer,
    ceo:     ceoReducer,
  },
});

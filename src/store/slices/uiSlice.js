import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    view: 'login', // 'login', 'dashboard', 'picker', 'statistics'
};

const uiSlice = createSlice({
    name: 'ui',
    initialState,
    reducers: {
        setView: (state, action) => {
            state.view = action.payload;
        },
    },
});

export const { setView } = uiSlice.actions;

export default uiSlice.reducer;

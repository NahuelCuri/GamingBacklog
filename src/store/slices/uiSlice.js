import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    view: 'login', // 'login', 'dashboard', 'picker', 'statistics', 'tier-lists', 'tier-list-editor'
    viewParams: null,
};

const uiSlice = createSlice({
    name: 'ui',
    initialState,
    reducers: {
        setView: (state, action) => {
            if (typeof action.payload === 'object' && action.payload.view) {
                state.view = action.payload.view;
                state.viewParams = action.payload.params || null;
            } else {
                state.view = action.payload;
                state.viewParams = null;
            }
        },
    },
});

export const { setView } = uiSlice.actions;

export default uiSlice.reducer;

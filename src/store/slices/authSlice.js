import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { loginUser, createUser } from '../../services/api';

const initialState = {
    user: null,
    token: localStorage.getItem('token') || null,
    status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
    error: null,
};

export const login = createAsyncThunk('auth/login', async (credentials) => {
    const response = await loginUser(credentials);
    return response;
});

export const register = createAsyncThunk('auth/register', async (userData) => {
    const response = await createUser(userData);
    return response;
});

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        logout: (state) => {
            state.user = null;
            state.token = null;
            state.status = 'idle';
            state.error = null;
            localStorage.removeItem('token');
        },
        // Useful for setting user derived from existing token on app init
        setUser: (state, action) => {
            state.user = action.payload;
        },
        setToken: (state, action) => {
            state.token = action.payload;
            if (action.payload) {
                localStorage.setItem('token', action.payload);
            } else {
                localStorage.removeItem('token');
            }
        }
    },
    extraReducers: (builder) => {
        builder
            // Login
            .addCase(login.pending, (state) => {
                state.status = 'loading';
                state.error = null;
            })
            .addCase(login.fulfilled, (state, action) => {
                state.status = 'succeeded';
                state.user = action.payload; // Payload is the user object (with ID, email, etc.)
                if (action.payload.token) {
                    state.token = action.payload.token;
                    localStorage.setItem('token', action.payload.token);
                }
            })
            .addCase(login.rejected, (state, action) => {
                state.status = 'failed';
                state.error = action.error.message;
            })
            // Register
            .addCase(register.pending, (state) => {
                state.status = 'loading';
                state.error = null;
            })
            .addCase(register.fulfilled, (state, action) => {
                state.status = 'succeeded';
                state.user = action.payload;
                if (action.payload.token) {
                    state.token = action.payload.token;
                    localStorage.setItem('token', action.payload.token);
                }
            })
            .addCase(register.rejected, (state, action) => {
                state.status = 'failed';
                state.error = action.error.message;
            });
    },
});

export const { logout, setUser, setToken } = authSlice.actions;

export default authSlice.reducer;

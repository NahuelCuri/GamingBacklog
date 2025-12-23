import axios from 'axios';

const API_URL = 'http://localhost:3000'; // Adjust if backend runs elsewhere

const api = axios.create({
    baseURL: API_URL,
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export const checkHealth = async () => {
    try {
        const response = await api.get('/health');
        return response.data;
    } catch (error) {
        console.error('Health check failed:', error);
        throw error;
    }
};

// --- Users ---
export const getUsers = async () => {
    const response = await api.get('/api/users');
    return response.data.data;
};

export const createUser = async (userData) => {
    const response = await api.post('/api/users', userData);
    return response.data.data;
};

export const loginUser = async (credentials) => {
    const response = await api.post('/api/users/login', credentials);
    return response.data.data;
};

// --- Games ---
export const getGames = async () => {
    const response = await api.get('/api/games');
    return response.data.data;
};

export const createGame = async (gameData) => {
    const response = await api.post('/api/games', gameData);
    return response.data.data;
};

export const updateGame = async (id, gameData) => {
    const response = await api.put(`/api/games/${id}`, gameData);
    return response.data.data;
};

export const deleteGame = async (id) => {
    const response = await api.delete(`/api/games/${id}`);
    return response.data;
};

export const uploadImage = async (file, gameName) => {
    const formData = new FormData();
    formData.append('image', file);
    if (gameName) {
        formData.append('game_name', gameName);
    }

    const response = await api.post('/api/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data.url;
};

export { API_URL };
export default api;

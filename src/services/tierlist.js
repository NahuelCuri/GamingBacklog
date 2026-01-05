import api from './api';

export const getTierLists = async () => {
    const response = await api.get('/api/tier-lists');
    return response.data;
};

export const getTierList = async (id) => {
    const response = await api.get(`/api/tier-lists/${id}`);
    return response.data;
};

export const createTierList = async (data) => {
    const response = await api.post('/api/tier-lists', data);
    return response.data;
};

export const updateTierList = async (id, data) => {
    const response = await api.put(`/api/tier-lists/${id}`, data);
    return response.data;
};

export const deleteTierList = async (id) => {
    const response = await api.delete(`/api/tier-lists/${id}`);
    return response.data;
};

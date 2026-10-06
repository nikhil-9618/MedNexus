import { api } from './api.js';

export const authService = {
  me: () => api.get('/auth/me'),
  changePassword: (payload) => api.post('/auth/change-password', payload),
};

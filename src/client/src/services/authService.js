import { api } from './api.js';

export const authService = {
  me: () => api.get('/auth/me'),
  // Changing a password revokes every outstanding session server-side and
  // returns a replacement token for this device. Storing it here keeps the
  // person who made the change signed in; without it their next request 401s.
  changePassword: async (payload) => {
    const res = await api.post('/auth/change-password', payload);
    if (res.data && res.data.token) {
      localStorage.setItem('md_token', res.data.token);
      setAuthToken(res.data.token);
    }
    return res;
  },
};

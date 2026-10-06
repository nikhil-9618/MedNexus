import { api } from './api.js';
import { changeIdentityPassword } from './identityService.js';

export const authService = {
  me: () => api.get('/auth/me'),
  changePassword: changeIdentityPassword,
};

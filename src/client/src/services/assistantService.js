import { api } from './api.js';

export const assistantService = {
  meta: () => api.get('/assistant/meta'),
  ask: (message) => api.post('/assistant', { message }),
};

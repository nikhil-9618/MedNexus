import { api } from './api.js';

export const recordService = {
  mine: (params) => api.get('/patients/me/records', { params }),
  forPatient: (patientId, params) => api.get(`/records/patient/${patientId}`, { params }),
  get: (id) => api.get(`/records/${id}`),
  create: (payload) => api.post('/records', payload),
  update: (id, payload) => api.put(`/records/${id}`, payload),
};

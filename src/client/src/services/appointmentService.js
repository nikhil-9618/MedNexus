import { api } from './api.js';
import { doctorService } from './doctorService.js';

export const appointmentService = {
  book: (payload) => api.post('/appointments', payload),
  list: (params) => api.get('/appointments', { params }),
  get: (id) => api.get(`/appointments/${id}`),
  update: (id, payload) => api.put(`/appointments/${id}`, payload),
  cancel: (id) => api.delete(`/appointments/${id}`),
  doctorAvailabilityFor: (doctorId, date) => doctorService.availability(doctorId, { date }),
};

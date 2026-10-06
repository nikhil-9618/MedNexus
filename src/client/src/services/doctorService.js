import { api } from './api.js';

export const doctorService = {
  list: (params) => api.get('/doctors', { params }),
  get: (id) => api.get(`/doctors/${id}`),
  availability: (id, params) => api.get(`/doctors/${id}/availability`, { params }),
  myAppointments: (params) => api.get('/doctors/me/appointments', { params }),
  myPatients: (params) => api.get('/doctors/me/patients', { params }),
  myDashboard: () => api.get('/doctors/me/dashboard'),
};

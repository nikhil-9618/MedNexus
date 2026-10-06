import { api } from './api.js';

export const adminService = {
  dashboard: (params) => api.get('/admin/dashboard', { params }),
  patients: (params) => api.get('/admin/patients', { params }),
  patient: (id) => api.get(`/admin/patients/${id}`),
  setPatientStatus: (id, status) => api.put(`/admin/patients/${id}/status`, { status }),
  doctors: (params) => api.get('/admin/doctors', { params }),
  createDoctor: (payload) => api.post('/admin/doctors', payload),
  updateDoctor: (id, payload) => api.put(`/admin/doctors/${id}`, payload),
  setDoctorStatus: (id, status) => api.put(`/admin/doctors/${id}/status`, { status }),
  appointments: (params) => api.get('/admin/appointments', { params }),
  setAppointmentStatus: (id, status) => api.put(`/admin/appointments/${id}/status`, { status }),
  departments: () => api.get('/admin/departments'),
  createDepartment: (payload) => api.post('/admin/departments', payload),
  updateDepartment: (code, payload) => api.put(`/admin/departments/${code}`, payload),
  deleteDepartment: (code) => api.delete(`/admin/departments/${code}`),
  auditLogs: (params) => api.get('/admin/audit-logs', { params }),
  digitalTwin: () => api.get('/admin/digital-twin'),
  settings: () => api.get('/admin/settings'),
  updateSettings: (settings) => api.put('/admin/settings', { settings }),
};

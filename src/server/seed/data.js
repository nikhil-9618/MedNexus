/**
 * Reference data for the clinic.
 *
 * This file intentionally contains NO accounts and NO patient information.
 * Earlier revisions seeded demo doctors, demo patients and demo logins from
 * here; those are gone, so the only way anyone signs in is:
 *   - the first administrator, created with `npm run create-admin`
 *   - doctors, provisioned by an administrator from Admin → Manage Doctors
 *   - patients, who self-register and verify their email
 */

const DEPARTMENTS = [
  { code: 'CARD', name: 'Cardiology', description: 'Heart and vascular care' },
  { code: 'DERM', name: 'Dermatology', description: 'Skin, hair and nail care' },
  { code: 'ORTHO', name: 'Orthopedics', description: 'Bones, joints and muscles' },
  { code: 'PEDIA', name: 'Pediatrics', description: 'Child healthcare' },
  { code: 'GENMED', name: 'General Medicine', description: 'Primary and internal medicine' },
  { code: 'NEURO', name: 'Neurology', description: 'Brain and nervous system' },
];

module.exports = { DEPARTMENTS };

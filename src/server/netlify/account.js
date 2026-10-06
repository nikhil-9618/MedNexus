const { z } = require('zod');

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(80),
  phone: z.string().trim().regex(/^[+]?[\d\s()-]{7,20}$/, 'Enter a valid phone number'),
  dob: z.string().refine((value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime())
      && date.toISOString().slice(0, 10) === value
      && value <= new Date().toISOString().slice(0, 10);
  }, 'Enter a valid date of birth that is not in the future'),
  gender: z.enum(['Female', 'Male', 'Other']),
  address: z.string().trim().max(200).optional(),
  bloodGroup: z.string().trim().max(5).optional(),
});

function profileFromIdentity(identity) {
  const metadata = identity.userMetadata || {};
  return profileSchema.safeParse({
    name: metadata.full_name,
    phone: metadata.phone,
    dob: metadata.dob,
    gender: metadata.gender,
  });
}

function accountRole(identity) {
  const roles = identity.appMetadata?.roles;
  if (Array.isArray(roles) && roles.includes('ADMIN')) return 'ADMIN';
  if (Array.isArray(roles) && roles.includes('DOCTOR')) return 'DOCTOR';
  return 'PATIENT';
}

function safeUser(identity, profile) {
  return {
    id: identity.id,
    name: profile?.name || identity.name || identity.email || 'Patient',
    email: identity.email,
    role: accountRole(identity),
    status: 'ACTIVE',
    createdAt: identity.createdAt || profile?.createdAt,
  };
}

function safePatient(profile) {
  return {
    id: profile.identityId,
    patientId: `PAT-${profile.identityId}`,
    phone: profile.phone,
    dob: profile.dob,
    gender: profile.gender,
    address: profile.address,
    bloodGroup: profile.bloodGroup,
  };
}

module.exports = { profileSchema, profileFromIdentity, accountRole, safeUser, safePatient };

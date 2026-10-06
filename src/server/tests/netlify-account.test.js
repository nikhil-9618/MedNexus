const { test } = require('node:test');
const assert = require('node:assert/strict');
const { profileSchema, profileFromIdentity, accountRole, safeUser, safePatient } = require('../netlify/account');

const profile = { name: 'Demo Patient', phone: '+1 555 010 1000', dob: '2000-01-15', gender: 'Other' };

test('Netlify account profile validates and normalizes signup details', () => {
  const parsed = profileSchema.parse({ ...profile, name: '  Demo Patient  ' });
  assert.equal(parsed.name, 'Demo Patient');
  assert.equal(profileSchema.safeParse({ ...profile, dob: '2000-02-30' }).success, false);
  assert.equal(profileSchema.safeParse({ ...profile, dob: '2999-01-01' }).success, false);
});

test('Netlify profile rejects changes to roles, email and identity IDs', () => {
  for (const field of ['role', 'email', 'identityId']) {
    assert.equal(profileSchema.strict().safeParse({ ...profile, [field]: 'changed' }).success, false);
  }
});

test('Netlify account roles use only administrator-controlled metadata', () => {
  assert.equal(accountRole({ userMetadata: { role: 'ADMIN', roles: ['ADMIN'] } }), 'PATIENT');
  assert.equal(accountRole({ roles: ['ADMIN'] }), 'PATIENT');
  assert.equal(accountRole({ appMetadata: { roles: ['DOCTOR'] } }), 'DOCTOR');
  assert.equal(accountRole({ appMetadata: { roles: ['ADMIN'] } }), 'ADMIN');
});

test('Netlify profiles are derived from validated identity metadata', () => {
  const parsed = profileFromIdentity({ userMetadata: { ...profile, full_name: profile.name } });
  assert.equal(parsed.success, true);
  assert.equal(profileFromIdentity({ userMetadata: { full_name: 'Demo' } }).success, false);
});

test('Netlify account responses expose no credentials or internal metadata', () => {
  const identity = { id: 'demo-id', email: 'demo@example.test', userMetadata: { password: 'not-a-real-password' } };
  const user = safeUser(identity, profile);
  const patient = safePatient({ ...profile, identityId: identity.id, address: '', bloodGroup: '' });
  assert.equal(user.role, 'PATIENT');
  assert.equal(user.name, profile.name);
  assert.equal(patient.patientId, 'PAT-demo-id');
  assert.equal('userMetadata' in user, false);
  assert.equal('password' in user, false);
});

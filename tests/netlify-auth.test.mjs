import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAccountHandler } from '../netlify/functions/account.mts';
import identityEvents from '../netlify/functions/identity.mts';

const identity = {
  id: 'demo-identity', email: 'demo@example.test', confirmedAt: '2026-10-06T00:00:00Z',
  userMetadata: { full_name: 'Demo Patient', phone: '+1 555 010 1000', dob: '2000-01-15', gender: 'Other' },
};
const profile = {
  identityId: identity.id, name: 'Demo Patient', phone: '+1 555 010 1000',
  dob: '2000-01-15', gender: 'Other', address: '', bloodGroup: '',
};

function handler(user = identity, overrides = {}) {
  return createAccountHandler({
    getUser: async () => user,
    loadProfile: async () => profile,
    saveProfile: async (_, data) => ({ ...profile, ...data }),
    ...overrides,
  });
}

function request(path = '/api/auth/me', options = {}) {
  return new Request(`https://demo.example.test${path}`, options);
}

test('account API requires an authenticated, confirmed identity', async () => {
  assert.equal((await handler(null)(request())).status, 401);
  assert.equal((await handler({ ...identity, confirmedAt: undefined })(request())).status, 403);
});

test('account API returns a safe account and persists only the authenticated profile', async () => {
  let owner;
  const response = await handler(identity, { loadProfile: async (user) => { owner = user.id; return profile; } })(request());
  assert.equal(response.status, 200);
  assert.equal(owner, identity.id);
  assert.equal((await response.json()).user.role, 'PATIENT');
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('profile API rejects cross-origin writes and unsupported methods', async () => {
  assert.equal((await handler()(request('/api/patients/me', { method: 'PUT' }))).status, 403);
  assert.equal((await handler()(request('/api/patients/me', {
    method: 'PUT', headers: { origin: 'https://attacker.example.test', 'content-type': 'application/json' }, body: '{}',
  }))).status, 403);
  assert.equal((await handler()(request('/api/auth/me', { method: 'DELETE' }))).status, 405);
});

test('profile API validates JSON, fields, and prevents privilege escalation', async () => {
  const options = { method: 'PUT', headers: { origin: 'https://demo.example.test', 'content-type': 'application/json' } };
  assert.equal((await handler()(request('/api/patients/me', { ...options, body: '{bad' }))).status, 400);
  assert.equal((await handler()(request('/api/patients/me', { ...options, body: JSON.stringify({ ...identity.userMetadata, role: 'ADMIN' }) }))).status, 400);
  const response = await handler()(request('/api/patients/me', {
    ...options, body: JSON.stringify({ name: profile.name, phone: profile.phone, dob: profile.dob, gender: profile.gender }),
  }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).patient.id, identity.id);
});

test('profile API denies nonpatients and masks database errors', async () => {
  const doctor = { ...identity, appMetadata: { roles: ['DOCTOR'] } };
  assert.equal((await handler(doctor)(request('/api/patients/me'))).status, 403);
  const response = await handler(identity, { loadProfile: async () => { throw new Error('private connection detail'); } })(request());
  assert.equal(response.status, 503);
  assert.equal((await response.text()).includes('private connection detail'), false);
});

test('Identity signup rejects invalid metadata and bot traps', () => {
  let denied = false;
  const deny = () => { denied = true; };
  identityEvents.userValidate({ user: identity, deny });
  assert.equal(denied, false);
  identityEvents.userValidate({ user: { ...identity, userMetadata: {} }, deny });
  assert.equal(denied, true);
  denied = false;
  identityEvents.userValidate({ user: { ...identity, userMetadata: { ...identity.userMetadata, website: 'bot' } }, deny });
  assert.equal(denied, true);
});

test('Identity signup always assigns patient access, regardless of supplied roles', () => {
  const result = identityEvents.userSignup({ user: { ...identity, appMetadata: { roles: ['ADMIN'] } }, deny() {} });
  assert.deepEqual(result.user.appMetadata.roles, ['PATIENT']);
});

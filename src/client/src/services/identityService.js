import {
  signup, login, logout, getUser, handleAuthCallback, updateUser,
  AuthError, MissingIdentityError,
} from '@netlify/identity';
import { api } from './api.js';

let initialization;

export function initializeIdentity() {
  if (!initialization) {
    initialization = (async () => {
      const callback = await handleAuthCallback();
      return { callback, identity: callback?.user || await getUser() };
    })();
  }
  return initialization;
}

export function identityError(error) {
  if (error instanceof MissingIdentityError) {
    return new Error('Account services are not enabled yet. Please try again after deployment.');
  }
  if (error instanceof AuthError && /not confirmed|not verified/i.test(error.message)) {
    const unverified = new Error('Confirm your email using the link in your inbox before signing in.');
    unverified.code = 'EMAIL_NOT_VERIFIED';
    return unverified;
  }
  if (error instanceof AuthError && error.status === 403) {
    return new Error('Account registration is currently disabled. Contact the clinic for an invitation.');
  }
  if (error instanceof AuthError && error.status === 429) {
    return new Error('Too many attempts. Please wait a moment and try again.');
  }
  return error;
}

export async function loadAccount() {
  const response = await api.get('/auth/me');
  return response.data.user;
}

export async function createIdentityAccount(payload) {
  try {
    const identity = await signup(payload.email.trim().toLowerCase(), payload.password, {
      full_name: payload.name,
      phone: payload.phone,
      dob: payload.dob,
      gender: payload.gender,
      website: payload.website || '',
    });
    if (!identity.confirmedAt) return { confirmationRequired: true, email: identity.email || payload.email };
    await login(payload.email.trim().toLowerCase(), payload.password);
    return { user: await loadAccount() };
  } catch (error) {
    throw identityError(error);
  }
}

export async function signIn(email, password, role) {
  try {
    await login(email.trim().toLowerCase(), password);
    const user = await loadAccount();
    if (role && user.role !== role) {
      await logout();
      throw new Error('This account does not have the selected role. Choose your account’s role and try again.');
    }
    return user;
  } catch (error) {
    throw identityError(error);
  }
}

export async function signOut() {
  await logout();
}

export async function changeIdentityPassword(payload) {
  if (payload.newPassword !== payload.confirmPassword) throw new Error('New passwords do not match.');
  if (payload.newPassword.length < 8 || payload.newPassword.length > 72
    || !/[A-Z]/.test(payload.newPassword) || !/[a-z]/.test(payload.newPassword)
    || !/[0-9]/.test(payload.newPassword)) {
    throw new Error('Use 8–72 characters with uppercase, lowercase, and a number.');
  }
  try {
    const identity = await getUser();
    if (!identity?.email) throw new Error('Please sign in before changing your password.');
    await login(identity.email, payload.currentPassword);
    await updateUser({ password: payload.newPassword });
    return { data: { message: 'Password updated.' } };
  } catch (error) {
    throw identityError(error);
  }
}

import { getUser, type User } from '@netlify/identity';
import type { Config } from '@netlify/functions';
import { eq } from 'drizzle-orm';
import { getDatabase } from '../../db/index.js';
import { accountProfiles } from '../../db/schema.js';
import account from '../../src/server/netlify/account.js';

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

async function loadProfile(identity: User) {
  const database = getDatabase();
  const existing = await database.select().from(accountProfiles)
    .where(eq(accountProfiles.identityId, identity.id)).limit(1);
  if (existing[0]) return existing[0];
  const parsed = account.profileFromIdentity(identity);
  if (!parsed.success) return null;
  await database.insert(accountProfiles).values({ identityId: identity.id, ...parsed.data })
    .onConflictDoNothing();
  const created = await database.select().from(accountProfiles)
    .where(eq(accountProfiles.identityId, identity.id)).limit(1);
  return created[0] || null;
}

async function saveProfile(identity: User, data: typeof accountProfiles.$inferInsert) {
  const database = getDatabase();
  const updated = await database.insert(accountProfiles)
    .values({ ...data, identityId: identity.id })
    .onConflictDoUpdate({
      target: accountProfiles.identityId,
      set: { ...data, identityId: identity.id, updatedAt: new Date() },
    }).returning();
  return updated[0];
}

export function createAccountHandler(dependencies = { getUser, loadProfile, saveProfile }) {
  return async (request: Request) => {
    const path = new URL(request.url).pathname;
    if (!['/api/auth/me', '/api/patients/me'].includes(path)) {
      return json({ message: 'Account endpoint not found.' }, 404);
    }
    if (request.method !== 'GET' && !(request.method === 'PUT' && path === '/api/patients/me')) {
      return json({ message: 'Method not allowed.' }, 405);
    }
    if (request.method === 'PUT') {
      const origin = request.headers.get('origin');
      if (!origin || origin !== new URL(request.url).origin) {
        return json({ message: 'This request must come from this site.' }, 403);
      }
      if (!request.headers.get('content-type')?.startsWith('application/json')) {
        return json({ message: 'Send a JSON profile.' }, 415);
      }
    }
    try {
      const identity = await dependencies.getUser();
      if (!identity) return json({ message: 'Please sign in to continue.' }, 401);
      if (!identity.confirmedAt) return json({ message: 'Confirm your email before continuing.' }, 403);
      const role = account.accountRole(identity);
      if (path === '/api/auth/me' && role !== 'PATIENT') {
        return json({ user: account.safeUser(identity, null) });
      }
      if (role !== 'PATIENT') return json({ message: 'Patient access required.' }, 403);
      let profile;
      if (request.method === 'PUT') {
        let body;
        try { body = await request.json(); }
        catch { return json({ message: 'Invalid JSON.' }, 400); }
        const parsed = account.profileSchema.strict().safeParse(body);
        if (!parsed.success) {
          return json({
            message: 'Check your profile details.',
            details: parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
          }, 400);
        }
        profile = await dependencies.saveProfile(identity, { ...parsed.data, identityId: identity.id });
      } else {
        profile = await dependencies.loadProfile(identity);
      }
      if (!profile) return json({ message: 'Your account profile needs to be completed. Contact the clinic.' }, 409);
      const user = account.safeUser(identity, profile);
      console.info(JSON.stringify({ action: request.method === 'PUT' ? 'PROFILE_UPDATE' : 'ACCOUNT_READ', result: 'SUCCESS' }));
      return json(path === '/api/auth/me' ? { user } : { user, patient: account.safePatient(profile) });
    } catch {
      return json({ message: 'Account services are temporarily unavailable. Please try again.' }, 503);
    }
  };
}

export default async (request: Request) => createAccountHandler()(request);

export const config: Config = {
  path: ['/api/auth/me', '/api/patients/me'],
  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};

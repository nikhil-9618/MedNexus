import type { UserSignupEvent, UserValidateEvent } from '@netlify/functions';
import account from '../../src/server/netlify/account.js';

export default {
  userValidate(event: UserValidateEvent) {
    const metadata = event.user.userMetadata || {};
    if (!account.profileFromIdentity(event.user).success || String(metadata.website || '').trim()) {
      return event.deny();
    }
  },
  userSignup(event: UserSignupEvent) {
    return {
      user: {
        ...event.user,
        appMetadata: { ...event.user.appMetadata, roles: ['PATIENT'] },
      },
    };
  },
};

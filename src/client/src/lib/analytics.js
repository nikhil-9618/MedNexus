/**
 * Privacy-first, consent-gated analytics.
 *
 * Non-negotiable rules:
 *  - Nothing is loaded, and no third-party request is made, unless the visitor
 *    has explicitly accepted non-essential storage in the cookie banner.
 *  - Nothing is loaded at all unless VITE_ANALYTICS_DOMAIN is configured at
 *    build time — an unconfigured deployment is a no-op.
 *  - The client bundle carries no secret. Only a public hostname is used.
 *
 * The configured host is expected to serve a Plausible-compatible script at
 * https://<domain>/js/script.js (which also tracks SPA route changes).
 */

const CONSENT_KEY = 'md_cookie_consent';
const CONSENT_EVENT = 'md:consent-changed';

const DOMAIN = (import.meta.env.VITE_ANALYTICS_DOMAIN || '').trim();

/** True when the build was configured with an analytics host. */
export const analyticsConfigured = Boolean(DOMAIN);

function hasConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'accepted';
  } catch {
    return false;
  }
}

let injected = false;

/** Inject the analytics script once, if configured and consented. */
export function loadAnalytics() {
  if (!analyticsConfigured || injected || !hasConsent()) return false;
  if (typeof document === 'undefined') return false;

  const script = document.createElement('script');
  script.defer = true;
  script.dataset.mdAnalytics = 'true';
  script.dataset.domain = DOMAIN;
  script.src = `https://${DOMAIN}/js/script.js`;
  document.head.appendChild(script);

  injected = true;
  return true;
}

/** Wire the consent banner to the loader. Safe to call unconditionally. */
export function initAnalytics() {
  loadAnalytics();
  window.addEventListener(CONSENT_EVENT, loadAnalytics);
}

/** Notify listeners that the visitor changed their storage choice. */
export function announceConsentChange() {
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

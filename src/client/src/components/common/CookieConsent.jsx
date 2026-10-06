import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cookie } from 'lucide-react';
import { PATHS } from '../../routes/paths.js';
import { announceConsentChange, analyticsConfigured } from '../../lib/analytics.js';

const STORAGE_KEY = 'md_cookie_consent';

/**
 * Cookie / local-storage consent banner.
 *
 * Essential storage (session token + this preference) is always on. Optional
 * privacy-friendly analytics is off until the visitor accepts, and is only
 * available at all when the deployment configures an analytics host — see
 * src/client/src/lib/analytics.js.
 */
export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function decide(choice) {
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      /* storage unavailable — the banner will simply show again next visit */
    }
    setVisible(false);
    // Lets the analytics loader start (or stay idle) without a page reload.
    announceConsentChange();
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie and storage notice"
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 sm:px-4 sm:pb-4"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-pop backdrop-blur sm:flex-row sm:items-center sm:gap-5">
        <div className="flex items-start gap-3 sm:flex-1">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Cookie className="h-4.5 w-4.5" />
          </span>
          <p className="text-xs leading-5 text-slate-600">
            <span className="font-bold text-slate-800">We keep this simple.</span> MedNexus needs
            essential browser storage for your signed-in session. No advertising trackers, ever.
            {analyticsConfigured
              ? ' Optional privacy-friendly analytics stays off unless you accept.'
              : ' No analytics or tracking scripts are loaded.'}{' '}
            See our{' '}
            <Link to={PATHS.privacy} className="font-semibold text-brand-700 hover:underline">
              privacy policy
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0 gap-2 sm:items-center">
          <button onClick={() => decide('declined')} className="btn-ghost px-4 py-2 text-xs">
            Essential only
          </button>
          <button onClick={() => decide('accepted')} className="btn-primary px-4 py-2 text-xs">
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

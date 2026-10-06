/**
 * Brand lockup — single source of truth for how MedNexus is displayed.
 *
 * `size` is the rendered logo height in px. The full lockup (mark + wordmark +
 * tagline) is 720x240; `withWordmark={false}` crops to the mark alone, which is
 * the same artwork trimmed to its bounds for small surfaces (topbars, avatars).
 */
import MedNexusLogo from './MedNexusLogo.jsx';

export default function Logo({ size = 44, withWordmark = true, animated = true, className = '' }) {
  return (
    <MedNexusLogo
      height={size}
      mark={!withWordmark}
      animated={animated}
      className={className}
    />
  );
}

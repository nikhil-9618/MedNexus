/**
 * MedNexus brand logo — the canonical, as-is brand mark.
 *
 * Artwork (do not redesign): connected heart mark (heart gradient + flowing EKG
 * + pulsing network nodes) with the "MedNexus" wordmark and the
 * "CONNECTED HEALTHCARE INTELLIGENCE" tagline.
 *
 * Canvas   : 720 x 240 (exact)
 * Gradients: heartGradient #071A33 -> #087F8C -> #22C7C9
 *            networkGradient #22C7C9 -> #6FF7F2
 *            textGradient #087F8C -> #22C7C9
 * Palette  : #071A33, #087F8C, #22C7C9, #6FF7F2, #64748B
 *
 * Motion: heartbeat, core pulse, node pulse, EKG dash flow, wordmark glow.
 * All motion is disabled under `prefers-reduced-motion: reduce`.
 */

const CSS = `
.mnl-heart,.mnl-halo{transform-box:fill-box;transform-origin:center}
.mnl-heart{animation:mnl-heartbeat 2.8s ease-in-out infinite}
.mnl-halo{animation:mnl-core 2.8s ease-in-out infinite}
.mnl-node{animation:mnl-node 2.4s ease-in-out infinite}
.mnl-ekg{stroke-dasharray:16 10;animation:mnl-ekg 2.2s linear infinite}
.mnl-word{animation:mnl-glow 3.4s ease-in-out infinite}
@keyframes mnl-heartbeat{0%,100%{transform:scale(1)}12%{transform:scale(1.055)}24%{transform:scale(1)}36%{transform:scale(1.03)}48%{transform:scale(1)}}
@keyframes mnl-core{0%,100%{opacity:.14}50%{opacity:.32}}
@keyframes mnl-node{0%,100%{opacity:.5}50%{opacity:1}}
@keyframes mnl-ekg{to{stroke-dashoffset:-26}}
@keyframes mnl-glow{0%,100%{opacity:1}50%{opacity:.85}}
@media (prefers-reduced-motion:reduce){.mnl-heart,.mnl-halo,.mnl-node,.mnl-ekg,.mnl-word{animation:none!important}}
`;

/** Full lockup canvas (exact) and the padded mark-only crop used at small sizes. */
const VIEW_FULL = '0 0 720 240';
const VIEW_MARK = '36 20 207 153';

export default function MedNexusLogo({
  height = 44,
  mark = false,
  animated = true,
  className = '',
}) {
  const viewBox = mark ? VIEW_MARK : VIEW_FULL;
  const [vbW, vbH] = (mark ? VIEW_MARK : VIEW_FULL).split(' ').slice(2).map(Number);
  const width = Math.round((height * vbW) / vbH);

  const cls = (name) => (animated ? ` ${name}` : '');

  return (
    <svg
      width={width}
      height={height}
      viewBox={viewBox}
      role="img"
      aria-label="MedNexus healthcare logo"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="heartGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#071A33" />
          <stop offset="55%" stopColor="#087F8C" />
          <stop offset="100%" stopColor="#22C7C9" />
        </linearGradient>
        <linearGradient id="networkGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22C7C9" />
          <stop offset="100%" stopColor="#6FF7F2" />
        </linearGradient>
        <linearGradient id="textGradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#087F8C" />
          <stop offset="100%" stopColor="#22C7C9" />
        </linearGradient>
      </defs>

      {animated && <style>{CSS}</style>}

      {/* ------------------------------- Mark ------------------------------- */}
      <g>
        {/* soft pulsing core behind the heart */}
        <circle
          className={'mnl-halo'}
          cx="138"
          cy="107"
          r="84"
          fill="#22C7C9"
          opacity="0.14"
        />

        {/* network links */}
        <g stroke="url(#networkGradient)" strokeWidth="2" strokeLinecap="round" opacity="0.75">
          <line x1="52" y1="62" x2="88" y2="78" />
          <line x1="226" y1="48" x2="192" y2="66" />
          <line x1="232" y1="144" x2="196" y2="130" />
          <line x1="46" y1="156" x2="86" y2="142" />
          <line x1="138" y1="30" x2="138" y2="52" />
        </g>

        {/* heart */}
        <path
          className={'mnl-heart'}
          d="M138 76 C129 47 90 43 74 64 C56 87 76 123 138 167 C200 123 220 87 202 64 C186 43 147 47 138 76 Z"
          fill="url(#heartGradient)"
        />

        {/* EKG trace flowing across the heart */}
        <path
          className={'mnl-ekg'}
          d="M88 120 H110 L118 109 L126 133 L137 96 L146 142 L155 120 H190"
          fill="none"
          stroke="url(#networkGradient)"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* pulsing network nodes */}
        <g fill="url(#networkGradient)">
          <circle className={'mnl-node'} cx="52" cy="62" r="4.5" />
          <circle className={'mnl-node'} cx="226" cy="48" r="4" style={{ animationDelay: '0.35s' }} />
          <circle className={'mnl-node'} cx="232" cy="144" r="4.5" style={{ animationDelay: '0.7s' }} />
          <circle className={'mnl-node'} cx="46" cy="156" r="4" style={{ animationDelay: '1.05s' }} />
          <circle className={'mnl-node'} cx="138" cy="30" r="4" style={{ animationDelay: '1.4s' }} />
        </g>
      </g>

      {/* ----------------------------- Wordmark ----------------------------- */}
      {!mark && (
        <g>
          <text
            x="255"
            y="116"
            fontFamily="Inter, Arial, Helvetica, sans-serif"
            fontSize="58"
            fontWeight="700"
            letterSpacing="-2.5"
            fill="#071A33"
          >
            Med
          </text>

          <text
            className={'mnl-word'}
            x="370"
            y="116"
            fontFamily="Inter, Arial, Helvetica, sans-serif"
            fontSize="58"
            fontWeight="700"
            letterSpacing="-2.5"
            fill="url(#textGradient)"
          >
            Nexus
          </text>

          {/* Tagline */}
          <text
            x="259"
            y="146"
            fontFamily="Inter, Arial, Helvetica, sans-serif"
            fontSize="11"
            fontWeight="600"
            letterSpacing="3.2"
            fill="#64748B"
          >
            CONNECTED HEALTHCARE INTELLIGENCE
          </text>
        </g>
      )}
    </svg>
  );
}

# APPROACH.md — MedNexus Architecture & Security Design

**Problem statement (PS-04 HealthTech):** build a secure clinic & appointment management
platform for patients, doctors, and clinic administrators — a real, fully functional product
(no mockups, no placeholder buttons, no fake APIs), styled after the provided MedNexus reference
design.

---

## 1. Solution Overview

MedNexus is a full-stack web application:

- **Frontend** — React 18 + Vite + Tailwind CSS, React Router, Axios, Context API,
  Lucide React icons, Recharts charts. JavaScript/JSX only.
- **Backend** — Node.js + Express + MongoDB (Mongoose), JWT (jsonwebtoken), bcryptjs,
  Zod validation, Helmet, CORS, express-rate-limit.
- **Security utilities** — isolated C tools in `src/security-tools/` (audit hash-chain
  verifier, input filter, password entropy meter, token-bucket rate limiter).

## 2. Architecture

```
Browser (React SPA)
   │  HTTPS / Authorization: Bearer <JWT>
   ▼
Express API (src/server)
   Rate limiter → Helmet → CORS → mongo-sanitize → body limit
   → JWT authentication → role authorization → resource-level authorization
   → Zod validation → Controller → Service → Mongoose/MongoDB
   → Audit log → Safe JSON response
```

- **Layered backend**: `routes → controllers → services → models`. Every service call that
  touches sensitive data writes an audit event.
- **API surface** (`src/server/routes/index.js`): auth, patients (me, records, dashboard,
  **history, prescriptions, lab-orders, notifications**), doctors (+ self routes at `/doctors/me`),
  appointments, records, **queues, consultations, prescriptions, lab-orders**, admin
  (users/doctors/appointments/departments/availability/audit/analytics/settings/**digital-twin**),
  assistant, health.

## 3. Data Model (Mongoose)

| Model | Key fields | Indexes |
|---|---|---|
| User | name, email (unique), passwordHash, role, status, lastLoginAt | email |
| Patient | userId, patientId (unique), dob, gender, phone, address, bloodGroup | patientId |
| Doctor | userId, doctorId (unique), specialization, department, experience, availability | doctorId |
| Appointment | patientId, doctorId, date, time, reason, status | patientId, doctorId, date, (doctorId,date,time) |
| MedicalRecord | patientId, doctorId, appointmentId, category, diagnosis, prescription, notes, date | patientId |
| AuditLog | userId, role, action, resourceType, resourceId, timestamp, ipAddress, result, detail | userId, timestamp |
| Department | name, code, description, active | code (unique) |
| Setting | key (unique), value, updatedBy | key |
| Queue | appointmentId (unique), patientId, doctorId, queue{status,position,tokenCode,departmentCode}, arrivedAt, calledAt, consultationStartedAt, completedAt | appointmentId, (departmentCode,status,position) |
| Consultation | consultationId (unique), appointmentId, patientId, doctorId, departmentCode, status, vitals, diagnosis, notes, followUpDate, referral | appointmentId, (patientId,createdAt), (departmentCode,status) |
| Prescription | prescriptionId (RX-…, unique), consultationId, patientId, doctorId, items[], status | prescriptionId, (patientId,createdAt) |
| LabOrder | orderId (LAB-…, unique), consultationId, patientId, doctorId, tests[], status | orderId, (patientId,createdAt) |
| Notification | patientId, queueId, type, title, message, tokenCode, read | (patientId,createdAt) |

**Department keys.** `Doctor.department` stores the department **name** ("Cardiology") while
queues, consultations, prescriptions and lab orders store the **code** ("CARD"). Every join
resolves through `HOSPITAL_DEPTS` in `src/server/config/constants.js` so grouping and
per-department views agree — see `resolveDepartmentCode` (workflow service),
`toDeptCode` (digital-twin controller) and `deptCodeOf` (seed).

## 4. Authentication & Authorization

- **AuthN**: bcrypt password hashing (10 rounds); JWT containing only `{ userId, role }`,
  signed with `JWT_SECRET`, expiring per `JWT_EXPIRES_IN`. Account status
  (ACTIVE / DISABLED / SUSPENDED) is checked on every login — disabled accounts cannot authenticate.
- **AuthZ (RBAC)**: PATIENT, DOCTOR, ADMIN roles enforced server-side via
  `src/server/middleware/role.middleware.js`. The role is read from the verified JWT — never
  trusted from the frontend.
- **Resource-level authorization**: `src/server/middleware/ownership.middleware.js` + service
  checks. Patients reach only their own profile/appointments/records; doctors reach only their
  own appointments and their authorized patients' records; admins manage per policy.
  Unauthorized access returns `403 { success: false, message: "Access denied" }` with no data leak.

## 5. Appointment Workflow & Integrity

- **Booking**: authenticate → validate doctor/date/time → verify doctor availability →
  check existing appointment → **re-verify availability inside a transaction immediately before
  insert** → create → audit. Double booking / unavailable slots return `409 Conflict`.
- **State machine**: `Scheduled → Confirmed`, `Confirmed → Completed`,
  `Scheduled → Cancelled`, `Confirmed → Cancelled`. Arbitrary transitions are rejected with
  `409 Invalid transition`.
- **Reschedule** runs the same availability verification as a new booking.
- **Queue issue**: a successful booking immediately issues a department token + queue entry
  (`workflow.service.createQueueForAppointment`). The appointment stores `departmentCode`,
  `token` and `queueId`. If queue creation fails the appointment is rolled back, so a booked
  appointment always has exactly one token.

## 5.1 Clinical Workflow (queue → consultation → prescription → lab)

```
Book appointment ─▶ Queue(Waiting, token GENMED-014)
                        │  admin/doctor POST /queues/advance
                        ▼
                   NowServing ──▶ DOCTOR POST /consultations/:appointmentId/start
                        ▼
              Queue(InConsultation) + Consultation(InProgress)
                        ▼
   DOCTOR POST /consultations/:appointmentId/complete
        ├─▶ Consultation(Completed)   ├─▶ Prescription RX-YYYYMMDD-####
        ├─▶ LabOrder LAB-YYYYMMDD-####├─▶ MedicalRecord
        └─▶ Appointment(Completed) + Queue(Completed) + Notification
```

Every transition writes an audit event and is authorized in the service layer
(`getConsultationWithAuth` / `getPrescriptionWithAuth` / `getLabOrderWithAuth`): a patient reads
only their own, a doctor only records they authored or their own patients', admin per policy.

## 5.2 Admin 3D Digital Twin

`GET /api/admin/digital-twin` (ADMIN only — non-admins get `403` and a `SECURITY_EVENT` audit
entry) returns the clinic state **read directly from MongoDB**: 14 departments with waiting /
now-serving / in-consultation tokens, active doctors per department, active consultations,
pending prescriptions and lab orders, appointments today and a `todaySummary`. Nothing is
synthesised in the controller — the 3D scene is a projection of live query results, and
departments with no real activity render as empty.

## 6. Medical Records

- Patient: READ own records only. Doctor: READ authorized patient records, CREATE records tied
  to an authorized consultation. Admin: per administrative policy.
- Every record access/create generates a `VIEW_MEDICAL_RECORD` / `CREATE_MEDICAL_RECORD` audit
  event. Audit logs never contain passwords, tokens, or full medical content.

## 7. Security Controls

| Control | Implementation |
|---|---|
| Rate limiting | Global, auth (login/register), and API limiters — `429` on abuse |
| Headers | Helmet (HSTS, CSP, frameguard, etc.) |
| CORS | `CLIENT_URL` allow-list — never wildcard in production |
| Input validation | Zod schemas for every request body/query |
| NoSQL injection | express-mongo-sanitize |
| Errors | Centralized error middleware — no stack traces, DB errors, or paths leak |
| Secrets | `.env` only (never committed); production boot fails fast without `JWT_SECRET`/`MONGODB_URI` |
| Audit | Append-only AuditLog collection + optional C hash-chain verifier (`src/security-tools/audit_chain.c`) |

## 8. AI Assistant

Deterministic, rule-based FAQ/navigation assistant (`src/server/services/assistant.service.js`).
It answers app-guidance questions (booking, cancelling, records, profile) and provides deep links.
It never diagnoses, prescribes, or recommends treatment, and displays a clear disclaimer.
No fake AI: when `AI_API_KEY` is absent the rule-based engine is used — by design.

## 9. Synthetic Data

`src/server/seed/seed.js` generates 20+ synthetic patients, 8+ synthetic doctors across
departments, 50+ appointments, a **queue token per live appointment**, medical records, and
audit logs. Demo accounts: `patient@mednexus.demo` / `doctor@mednexus.demo` /
`admin@mednexus.demo` (development-only passwords documented in README).

Synthetic-data disclosure lives where it is legally relevant — the Privacy page, the login
demo-account panel and the records notice — rather than on every operational screen.

## 10. Milestones

| # | Milestone | Status |
|---|---|---|
| 1 | Project setup + design system (Tailwind tokens, logo, components) | Done |
| 2 | Landing + Login + Registration | Done |
| 3 | Patient portal (dashboard, profile, booking, appointments, records, history) | Done |
| 4 | Doctor portal (dashboard, appointments, patients, records) | Done |
| 5 | Admin portal (dashboard, manage, audit logs, analytics, settings) | Done |
| 6 | Backend + MongoDB models + seed | Done |
| 7 | JWT authentication + bcrypt | Done |
| 8 | RBAC + resource-level authorization | Done |
| 9 | Appointment system (availability, conflicts, state machine) | Done |
| 10 | Medical records (audited read/create) | Done |
| 11 | Audit logging | Done |
| 12 | AI assistant (rule-based) | Done |
| 13 | Security testing (server/tests + checklist) | Done |
| 14 | Responsive optimization (sidebar drawer, mobile bottom nav) | Done |
| 15 | Production build verification | Done |
| 16 | MedNexus-aligned repo architecture (src/, docs/, metadata/, deployment/) | Done |
| 17 | Queue lifecycle + department tokens (book → advance → start → complete) | Done |
| 18 | Consultations, prescriptions (RX-…) and lab orders (LAB-…) | Done |
| 19 | Patient medical history, prescriptions, lab orders and notifications | Done |
| 20 | Admin-only 3D digital twin fed by live MongoDB aggregates | Done |
| 21 | Full MedNexus rebrand + canonical logo lockup everywhere | Done |
| 22 | Dashboard de-clutter and removal of security exposition from the website | Done |
| 23 | Email-OTP verification on patient registration (hashed OTP, TTL, attempt cap, resend cooldown) | Done |
| 24 | 20-item public-website launch checklist (legal pages, meta, robots/sitemap, consent, 404, a11y) | Done |
| 25 | Bot/spam traps + `DENIED` audit trail, proven live and by automated test | Done |
| 26 | Deployment tooling (Docker Compose, Render Blueprint, Vercel config) and version control | Done |

---

## 11. Brand Identity

The product name is **MedNexus** (never MediDesk). The brand mark is a single canonical SVG
(`src/client/src/components/common/MedNexusLogo.jsx`), also mirrored as `public/favicon.svg`:

- Canvas `720 x 240`; gradients `heartGradient` (#071A33 → #087F8C → #22C7C9),
  `networkGradient` (#22C7C9 → #6FF7F2), `textGradient` (#087F8C → #22C7C9).
- Palette: **#071A33, #087F8C, #22C7C9, #6FF7F2, #64748B**.
- Wordmark "Med" (x=255) + "Nexus" (x=370) at 58px/700/-2.5, tagline
  `CONNECTED HEALTHCARE INTELLIGENCE` at 11px/600/+3.2.
- Motion: heartbeat, core pulse, node pulse, EKG dash flow, wordmark glow — all disabled under
  `prefers-reduced-motion: reduce`.

`components/common/Logo.jsx` is the only wrapper; `size` sets the rendered height and
`withWordmark={false}` crops to the mark's bounds for compact topbars. The logo is never
redrawn or substituted, and it is always placed on a light surface so the navy wordmark stays
legible.

## 12. Website Content Policy

The website presents only the application itself. Security architecture (JWT/RBAC/bcrypt/rate
limiting/audit pipeline), the previous `SecurityPage`, `SecurityIndicator` and the request-pipeline
diagram have been removed from the client. Security remains fully enforced server-side and in the
admin console's operational Audit Logs tool; it is simply not product marketing. The tagline
`CONNECTED HEALTHCARE INTELLIGENCE` replaces "Secure care. Smarter appointments."

## 13. Deployment Topology

`deployment/` holds two supported paths. Both run the same unmodified `src/` tree.

**A — Docker Compose (self-hosted, one command)**

| Service | Image | Notes |
|---|---|---|
| `mongo` | `mongo:7` | named volume, no published port |
| `api` | `node:20-alpine` (`Dockerfile.server`) | non-root `node` user, tini as PID 1, `npm ci --omit=dev --omit=optional`, healthcheck on `/api/health` |
| `web` | `nginx:1.27-alpine` (`Dockerfile.client`) | Vite build → static assets, SPA fallback, `/api/` proxied to `http://api:5000` |

`docker-compose.yml` gates `api` on Mongo's healthcheck and `web` on the API's, and requires
`JWT_SECRET` via `${JWT_SECRET:?...}` so a stack can never boot with a placeholder secret.
`nginx.conf` adds gzip, HSTS, a CSP with `upgrade-insecure-requests`, immutable caching for
`/assets/` (hashed filenames) and `no-cache` for `index.html`.

**B — Render + Vercel + Atlas (managed cloud)**

`deployment/render.yaml` is a Render Blueprint for the API (rootDir `src/server`, health check
`/api/health`, `FORCE_HTTPS=true`, `TRUST_PROXY=1`, `generateValue` for `JWT_SECRET` and the seed
passwords) with MongoDB Atlas as `MONGODB_URI`. `src/client/vercel.json` deploys the SPA with an
SPA rewrite that excludes `/api`, plus cache and security headers. Step-by-step instructions,
the full environment-variable table, a secrets-never-in-browser verification (`grep`) and a
post-deploy checklist live in `deployment/README.md`.

Configuration precedence is unchanged: `src/server/config/env.js` is the **only** module that
reads `process.env`. It fails fast in production when `MONGODB_URI` is missing, `JWT_SECRET` is
shorter than 32 characters or looks like a placeholder, or `CLIENT_URL` is unset.

## 14. Launch Checklist — Production Hardening

| # | Item | Implementation |
|---|---|---|
| 1 | Privacy policy | `pages/public/PrivacyPage.jsx` at `/privacy` |
| 2 | Terms & conditions | `pages/public/TermsPage.jsx` at `/terms` |
| 3 | Secrets off the front end | Client reads only `VITE_API_URL` / `VITE_ANALYTICS_DOMAIN`; `services/api.js` defaults to the same-origin `/api` proxy |
| 4 | Force HTTPS | 308 middleware in `app.js` (prod + `FORCE_HTTPS`) honouring `x-forwarded-proto` and localhost; HSTS from Helmet; host-level HSTS/redirect in `nginx.conf` |
| 5 | Cookie consent banner | `components/common/CookieConsent.jsx`, `localStorage.md_cookie_consent`, copy branches on whether analytics is configured |
| 6 | Meta titles & descriptions | Per-page `<title>`/description plus full OG + Twitter tags in `index.html` |
| 7 | Social preview image | `public/og-image.svg` (1200×630), referenced by `og:image` and `twitter:image` |
| 8 | Favicon | `public/favicon.svg` + `apple-touch-icon` link, matching the canonical logo |
| 9 | Sitemap & robots | `public/sitemap.xml` (7 public URLs), `public/robots.txt` (declares the sitemap, disallows private portals) |
| 10 | Alt text | The client ships **zero** `<img>` elements; every mark is an inline SVG with `role="img"` + `aria-label` |
| 11 | Image compression | N/A by construction — assets are SVG text. The only binary weight is the lazily loaded 3D chunk |
| 12 | Page-load speed | Route-level `lazy()` for every signed-in page + `manualChunks` vendor split; measured initial entry **118.88 kB** (from ~832 kB) |
| 13 | Colour contrast | `tailwind.config.js` redefines `slate[500]` to `#5b6b7f`; all 86 `text-slate-400` uses replaced; ratios documented in the config |
| 14 | Mobile friendly | Sidebar drawer, patient bottom nav, responsive grids; rendered and checked at 375×812 |
| 15 | Custom 404 | `pages/public/NotFoundPage.jsx` for unmatched routes + SPA fallback on the host |
| 16 | Broken links | Every `PATHS.*` resolves, no unresolved literals, sitemap URLs map to real routes, `index.html` asset refs exist |
| 17 | Form validation | Client-side field validation + Zod schemas server-side (authoritative) |
| 18 | Spam/bot protection | Honeypot field + minimum fill time, rejected before any I/O with a generic 400 and a `DENIED` audit row |
| 19 | Analytics | `lib/analytics.js` — env-driven and consent-gated; a complete no-op (no third-party request) when unconfigured |
| 20 | One clear call to action | `Enter MedNexus` on the landing hero, with sign-in as the secondary action |

## 15. Abuse & Bot Protection

Registration is the only unauthenticated write, so it carries the traps:

- A hidden `website` honeypot field rendered inside an `aria-hidden` wrapper, off-screen and
  `tabIndex={-1}`, that no human can reach.
- `formStartedAt` is captured on mount and posted with the form; a submission faster than
  `HUMAN_FILL_MS` (1500 ms) is treated as scripted.
- Both checks run **before any database or hashing work**, return the same generic
  `400` ("We could not process this registration. Please try again.") so a bot learns nothing,
  and write an `AuditLog` row with `action: REGISTER`, `role: SYSTEM`, `result: DENIED` and a
  `detail` naming the reason — visible to admins in the Audit Logs tool.
- Omitting the bot fields is not penalised, so older/hand-rolled clients are never locked out.

The enum values matter: `AuditLog.role` and `.result` are schema enums, and an out-of-enum value
is rejected silently — the trap would have blocked the request while logging nothing.

## 16. Analytics & Consent

The analytics loader reads `VITE_ANALYTICS_DOMAIN`. With the variable absent — the default —
`loadAnalytics()` returns immediately and **no third-party script or network request ever
happens**. With a domain configured, the script is injected only when
`localStorage.md_cookie_consent === 'accepted'`. Choosing "Essential only" keeps it blocked, and
the banner emits a `md:consent-changed` event so a later acceptance loads analytics without a
reload. The banner text reflects which mode the build is in, so it never promises analytics that
do not exist.

## 17. Accessibility & Colour Contrast

The secondary-text token was the one real contrast failure: `slate-400` (#94a3b8) measures
2.56:1 on white, below the 4.5:1 requirement for body text. `slate[500]` is therefore redefined
to `#5b6b7f`, which measures **5.45** on white, **5.21** on slate-50, **4.97** on slate-100 and
**5.09** on brand-50 — AA everywhere it is used. On dark surfaces `text-slate-300` reads 6.96:1
on slate-900 and is left alone; `text-slate-300` survives on light surfaces only for genuinely
disabled controls. Semantic text colours were moved one step darker where they carried meaning
(`emerald-600 → emerald-700`, `amber-600 → amber-700`). Contrast ratios are recorded next to
the token definition in `tailwind.config.js` so the reasoning cannot drift from the value.

## 18. Front-end Performance Budget

The landing page is the product's shop window, so it must not download a dashboard. All
signed-in pages — patient, doctor, admin and the assistant — are `lazy()` imports, and the
layout keeps the sidebar, topbar and identity mounted while a chunk arrives (a `Suspense`
boundary inside `DashboardLayout`, plus one dedicated to the 3D twin). Vendor code is split into
`vendor-react`, `vendor-charts` and `vendor-icons`; three.js and drei are deliberately **not**
listed, so they stay inside the twin's own chunk. Recharts (421.92 kB) is referenced by no route
in `dist/index.html`, so a visitor on the public site never fetches it.

Measured production build: entry `index` **118.88 kB** (153 kB before split → 832 kB before
route splitting), `vendor-react` 165.18 kB, `vendor-icons` 29.90 kB, CSS 46.69 kB, ~25 route
chunks of 2–11 kB, and the twin at 861.50 kB fetched only when an admin opens it.

## 19. Version Control

`git init -b main` was run in-workspace. `.gitattributes` normalises text to LF, marks binary
assets and hides `package-lock.json` from diffs; `.gitignore` covers `.env`, build output,
`node_modules`, Freebuff session state and `.freebuff/`, while `!.env.*.example` keeps the
example files tracked. Secrets were verified absent from the index (`git ls-files | grep '\.env$'`
returns nothing). No remote is configured yet, so nothing has been pushed.

## 20. Signup Verification: Code Delivery, Recovery and Durable State

Patient signup is a two-step flow: `POST /api/auth/register` creates the account with
`emailVerified: false` and issues a 6-digit code, then `POST /api/auth/verify-otp` confirms it
and is the only thing that issues a session. Until that happens, `login` refuses the account with
403. Three gaps made the flow look broken in practice, all fixed here.

**Code delivery.** The `otp.service` `deliver()` transport only wrote codes to the server log, so
no message ever reached an inbox. `services/email.service.js` now sends the code through Resend's
HTTP API using the runtime's global `fetch` — no new dependency, which keeps the Render install
lean. `RESEND_API_KEY` enables it; without a key the service reports `isConfigured() === false`
and `deliver()` falls back to the console transport. A provider failure is logged and also falls
back, so an outage can never fail registration. The HTML part escapes the recipient's name, so a
crafted display name cannot inject markup into the mail.

Registration and resend now return `delivered: true|false`, letting the UI say where the code
actually went instead of always claiming "check your email". `devOtp` remains gated on
`isDev || isTest || otpEcho`, verified in production mode to be absent when the echo switch is off.

**Recovery from the sign-in form.** An account that was never confirmed could not sign in and the
login page only showed a toast, so the user was stranded with no route back to verification. The
unverified refusal now carries a stable machine-readable `code: 'EMAIL_NOT_VERIFIED'` (new
`ApiError` `code` field, emitted by the error middleware only for our own errors, never for a raw
driver error). The login page branches on it and navigates to `/verify-email`, which renders the
same step-2 component with the address prefilled and resend available.

**Durable development state.** With `MONGODB_URI` empty the DB layer started a purely in-memory
MongoDB, so every restart erased all accounts and their pending codes — a code shown minutes
earlier then matched nothing. The zero-setup instance is now backed by a real data directory
(`src/server/.data/mongodb`, git-ignored), so registrations and pending codes survive restarts.
A missing directory is created first: `mongodb-memory-server` fails with `ENOENT` on `scandir`
rather than creating it. Tests keep a throwaway store so runs never inherit each other's state.

**Evidence.** 33/33 API tests (new: "an unconfirmed signup can be recovered from the login page"
walks register → blocked login with the code → resend → verify → login), 15/15 security checklist
controls, 5/5 stubbed email-transport checks (request shape, injection escaping, provider error
and network failure degradation), and 5/5 production-mode checks with `OTP_DEV_ECHO` both off
(no code leaked) and on. Verified live: an OTP issued before a full server restart still validated
afterwards, and the browser walked unconfirmed login → `/verify-email` → resend → verify → portal.

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

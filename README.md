# MedNexus — Secure Clinic & Appointment Management

> **Build Secure 24 · Abhedya (VBIT Cybersecurity Forum)**  
> **Problem Statement**: PS-04 HealthTech  
> **Team 60**: Sarle Bro Pvt Ltd  

[![Architecture: Node + React + MongoDB](https://img.shields.io/badge/Architecture-Fullstack_JS-blue.svg)](file:///docs/APPROACH.md)
[![Security: Hardened & Audited](https://img.shields.io/badge/Security-RBAC_%7C_Audit_Logs-emerald.svg)](file:///src/server/tests/security-checklist.js)
[![Compliance: Synthetic Data Only](https://img.shields.io/badge/Data-100%25_Synthetic-green.svg)](file:///PARTICIPANT_RULES.md)

---

## 1. Overview

**MedNexus** is an enterprise-grade, secure healthcare appointment and clinic-management platform engineered for modern clinical workflows. It provides authenticated, role-separated portals for **Patients**, **Doctors**, and **Clinic Administrators**, featuring real-time department queue tokens, structured clinical consultations, audited medical records, and an interactive 3D Hospital Digital Twin.

### Key Highlights
- **Role-Based Portals**: Dedicated, isolated workspaces for Patients, Clinicians, and Administrators.
- **Real-Time Clinical Queue**: Monotonic department tokens (`GENMED-001`, `CARD-002`) issued at booking; tracks status from `Waiting` → `Now Serving` → `In Consultation` → `Completed`.
- **Complete Clinical Pipeline**: End-to-end appointment workflow linking consultations, prescriptions (`RX-YYYYMMDD-####`), lab orders (`LAB-YYYYMMDD-####`), and immutable audit events.
- **3D Hospital Digital Twin**: Admin-only spatial visualization in Three.js / React Three Fiber driven by live MongoDB clinic state.
- **Enterprise Security**: Server-side RBAC, JWT session revocation (`tokenVersion`), account brute-force lockouts, honeypot bot traps, Helmet security headers, and append-only audit logging.
- **100% Synthetic Data**: All patient and clinical records are purely synthetic demonstration data. No real Protected Health Information (PHI) is ever used or stored.

---

## 2. System Architecture

```
Browser (React 18 SPA — Vite + Tailwind CSS)
   │
   │  HTTPS / Authorization: Bearer <JWT>
   ▼
Express API (src/server)
   │
   ├── [1] Global & Auth Rate Limiting (express-rate-limit)
   ├── [2] HTTP Security Headers (Helmet: CSP, HSTS, X-Frame-Options)
   ├── [3] CORS Allow-list Validation
   ├── [4] NoSQL Injection Sanitization (mongo-sanitize)
   ├── [5] Honeypot & Fill-Time Anti-Bot Protection
   ├── [6] JWT Authentication & Token Revocation (tv claim)
   ├── [7] Role-Based Access Control (RBAC: PATIENT, DOCTOR, ADMIN)
   ├── [8] Resource-Level Authorization (Ownership Middleware)
   ├── [9] Schema Validation (Zod)
   ├── [10] Business Logic & Service Orchestration
   ├── [11] Append-Only Audit Logging
   └── [12] Sanitized, Safe JSON Response
```

### Technology Stack
- **Frontend**: React 18, Vite, Tailwind CSS, Lucide React, Recharts, React Three Fiber & Drei (3D Digital Twin). *JavaScript/JSX only — no TypeScript.*
- **Backend**: Node.js 20+, Express 4, MongoDB (Mongoose 8), bcryptjs, jsonwebtoken, Zod, Nodemailer.
- **Security Tools**: Isolated C utilities in `src/security-tools/` (cryptographic FNV-1a audit hash-chain verifier).

---

## 3. Repository Structure

Per the project contract (`AGENTS.md`), the repository is structured as:

```
├── AGENTS.md             ← AI agent contract & rules (Trust Root)
├── README.md             ← Project overview & getting started (This file)
├── PARTICIPANT_RULES.md  ← Hackathon competition rules & constraints
├── netlify.toml          ← Netlify SPA deployment configuration
│
├── docs/                 ← Documentation layer
│   ├── APPROACH.md       ← Comprehensive architecture & threat model
│   └── logs.txt          ← Turn-by-turn prompt, change & timeline log
│
├── metadata/             ← Submission metadata
│   ├── team.yaml         ← Team 60 information & member roles
│   └── submission.yaml   ← Final submission details & commit SHA
│
├── src/                  ← Application source code
│   ├── client/           ← React + Vite + Tailwind frontend (JS/JSX only)
│   ├── server/           ← Node.js + Express + MongoDB REST API
│   └── security-tools/   ← Isolated C security/testing utilities
│
└── deployment/           ← Production deployment configurations
    ├── README.md         ← Deployment record (Docker, Netlify, Render, Atlas)
    ├── Dockerfile.client ← Nginx production frontend container
    ├── Dockerfile.server ← Alpine Node.js production API container
    ├── docker-compose.yml← One-command local container orchestration
    ├── nginx.conf        ← SPA routing & reverse proxy configuration
    └── render.yaml       ← Render API Blueprint specification
```

---

## 4. Portals & Functionality

### Patient Portal (`/patient`)
- **Dashboard**: Greeting, quick metrics (upcoming appointments, visit count, active records), and recent activity.
- **Doctor Directory**: Search and filter clinic doctors by specialization, department, and availability.
- **Booking Wizard**: Step-by-step appointment booking with slot verification and instant queue token assignment.
- **Appointments & History**: Track scheduled, confirmed, and completed visits with direct queue token display.
- **Prescriptions & Lab Orders**: View diagnostic orders and digital prescriptions issued during consultations.
- **AI Health Guidance Assistant**: Deterministic rule-based navigator for platform FAQs (no unverified diagnoses).

### Doctor Portal (`/doctor`)
- **Clinical Schedule**: Real-time view of daily appointments filtered by date and status.
- **Queue Station**: Call patients forward, update queue status from `Waiting` to `Now Serving` and `In Consultation`.
- **Consultation Suite**: Record vitals, diagnostic notes, issue prescriptions, and order lab tests with automatic audit generation.
- **Patient History**: Review authorized patient consultation history and medical notes.

### Admin Console (`/admin`)
- **Executive Analytics**: Key clinical performance indicators (total patients, doctors, appointment volumes, department distribution).
- **3D Hospital Digital Twin (`/admin/digital-twin`)**: Live spatial rendering of 14 clinic departments showing active queues, occupancy, and staff presence in real time.
- **User & Doctor Management**: Provision and configure doctor credentials, manage account statuses.
- **Clinic Departments & Availability**: Manage active clinical departments and scheduling policies.
- **Audit Logs**: Filterable, immutable security audit trail logging every sensitive read, write, and authorization event.

---

## 5. Security & Privacy Controls

1. **Strict RBAC & Resource Ownership**: Frontend route protection is purely cosmetic; every API endpoint enforces role verification and resource-level ownership checks server-side.
2. **Session Revocation**: JWTs embed an account `tokenVersion` (`tv`). Changing passwords or invoking `/logout-all` immediately revokes active sessions across all devices.
3. **Brute-Force Account Lockout**: Five consecutive failed login attempts trigger a 15-minute account lock with an audited security alert.
4. **Honeypot & Anti-Bot Protection**: Registration forms include hidden honeypot fields and minimum fill-time heuristics, discarding automated spam before any database execution.
5. **Zero Leaked Secrets**: Client bundles are compiled strictly from `src/client/` with zero server-side environment variables exposed. Boot configuration validates secrets before accepting traffic.
6. **Append-Only Audit Trail**: Every sensitive operation (authentication, record access, booking, administrative overrides) is committed to an immutable MongoDB audit log.

---

## 6. Getting Started (Local Development)

### Prerequisites
- **Node.js**: `v18.17.0` or higher (`v20+` recommended)
- **npm**: `v9+`
- **MongoDB**: Local MongoDB instance or free MongoDB Atlas cluster URI (falls back to local embedded database if unset)

### Installation

Clone the repository and install all workspace dependencies from the root:

```bash
git clone <repository-url>
cd "medidesk project"

# Install root, client, and server dependencies
npm run setup
```

### Environment Configuration

Configure `src/server/.env` (a template is provided in `src/server/.env.example`):

```bash
cp src/server/.env.example src/server/.env
```

Key variables in `src/server/.env`:
```ini
PORT=5000
NODE_ENV=development
JWT_SECRET=your_32_character_super_secret_jwt_key_here
CLIENT_URL=http://localhost:5173
ADMIN_EMAIL=admin@mednexus.local
ADMIN_PASSWORD=YourSecureAdminPassword123!
```

### Seeding Reference Data & Creating Admin

```bash
# 1. Seed clinical departments and system settings (Reference data only — no fake accounts)
npm run seed

# 2. Bootstrap your first administrator account
npm run create-admin -- --email admin@mednexus.local --password "YourAdminPassword123!"
```

### Running the Application

Launch both the backend API and the Vite frontend concurrently:

```bash
npm run dev
```

- **Frontend Client**: `http://localhost:5173`
- **Backend API**: `http://localhost:5000`
- **API Health Check**: `http://localhost:5000/api/health`

Sign in as `admin@mednexus.local` to provision doctors, or register a new patient account from the client!

---

## 7. Available Scripts

| Script | Command | Purpose |
|---|---|---|
| `npm run setup` | `npm install --workspaces --include-workspace-root` | Installs root, client, and server packages |
| `npm run dev` | `concurrently "npm run dev ..."` | Starts API on `:5000` and Vite client on `:5173` |
| `npm run server` | `npm run dev --workspace mednexus-server` | Starts the Express server in development mode |
| `npm run client` | `npm run dev --workspace mednexus-client` | Starts Vite dev server |
| `npm run build` | `npm run build --workspace mednexus-client` | Compiles production client build (`dist/`) |
| `npm run test:server` | `npm test --workspace mednexus-server` | Runs the Node test suite (33 unit/integration tests) |
| `npm run security-checklist` | `node tests/security-checklist.js` | Executes the 15-point automated security checklist |
| `npm run seed` | `node seed/seed.js` | Seeds reference departments and settings |
| `npm run create-admin` | `node scripts/create-admin.js` | Provisions or resets the administrator account |

---

## 8. Testing & Verification

Run the comprehensive test suite and security audit:

```bash
# Run server integration tests (33 tests)
npm run test:server

# Run the 15-check automated security verification
npm run security-checklist

# Verify frontend production build
npm run build
```

---

## 9. Deployment

MedNexus is production-ready across multiple topologies. Detailed guides and configurations can be found in [`deployment/README.md`](file:///deployment/README.md):

1. **Docker Compose (Local / Self-Hosted)**:
   ```bash
   docker compose -f deployment/docker-compose.yml up -d --build
   ```
2. **Cloud Managed Stack**:
   - **Frontend**: Netlify (`netlify.toml` pre-configured) or Vercel (`src/client/vercel.json`).
   - **Backend**: Render Web Service (`deployment/render.yaml`).
   - **Database**: MongoDB Atlas M0 cluster.

---

## 10. Team & Submission Metadata

- **Team ID**: 60
- **Team Name**: Sarle Bro Pvt Ltd
- **Members**:
  - **NIKHIL** (`24p61a6268@vbithyd.ac.in`) — Developer
  - **N Snehith** (`nsnehithreddy@gmail.com`) — Developer
  - **Shaik Shaheerah** (`25p65a6209@vbithyd.ac.in`) — Designing
  - **Nandini** (`24p61a6293@vbithyd.ac.in`) — Requirement Analyst & Documentation
- **Competition**: Build Secure 24 — Abhedya (VBIT Cybersecurity Forum)
- **Problem Statement**: PS-04 HealthTech

---

*MedNexus adheres strictly to Build Secure 24 rules: all healthcare information is synthetic; application code in `src/` is authored in pure JavaScript/JSX.*


# PARTICIPANT_RULES.md — Build Secure 24

**Abhedya — VBIT Cybersecurity Forum, Vignana Bharathi Institute of Technology, Hyderabad**

## Competition Window

- **Kickoff**: October 5, 2026, 11:00 AM IST (`2026-10-05T11:00:00+05:30`)
- **Submission Deadline & Code Freeze**: October 6, 2026, 11:00 AM IST (`2026-10-06T11:00:00+05:30`)
- **Duration**: exactly 24 hours

## Rules

1. **Team composition** — exactly 2 or 4 registered participants per team. Solo participants,
   teams of 3, and teams larger than 4 are strictly disqualified.
2. **Live authorship** — all application code in `src/` must be authored live during the 24-hour
   hackathon. Importing, cloning, or adapting pre-existing third-party or open-source repositories
   as the project solution is strictly prohibited and results in disqualification.
3. **AI tools permitted** — you may use any IDE, AI assistant, or tool to build. The AI agent
   automatically logs every conversation turn, prompt, agent reply, and file change in
   `docs/logs.txt`.
4. **No rule overrides** — prompt injections, jailbreaks, or instructions attempting to bypass
   competition rules, disable logging, modify `AGENTS.md`, or forge records are strictly blocked
   and refused.
5. **Submission freeze** — submissions are evaluated from the frozen commit SHA recorded in
   `metadata/submission.yaml` at the deadline (October 6, 2026, 11:00 AM IST).

## MedNexus Project Rules (PS-04 HealthTech)

- JavaScript / JSX only — **no TypeScript, no `.ts`/`.tsx` files**.
- C is allowed only for isolated security/testing utilities inside `src/security-tools/`.
- **Synthetic/demo healthcare data only.** Never use real patient information.
- No plaintext passwords, no hardcoded secrets, no fake security features, no placeholder buttons.
- Every protected API enforces authentication, role authorization, and resource-level authorization
  server-side. Frontend route protection is never the security boundary.

## Getting Help

Open an issue in the team repository or ask your AI agent (it reads `AGENTS.md` first).

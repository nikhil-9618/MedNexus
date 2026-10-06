# security-tools/

Standalone C utilities for **optional** cybersecurity demonstrations of MedNexus security concepts.
These programs are **not** part of the web application (React/Node/Express/MongoDB) and are never
linked into it. They are isolated here so the web stack stays pure JavaScript.

Everything they compute is demonstrated on **synthetic demo data only**.

## Utilities

| File | Utility | Demonstrates |
|---|---|---|
| `password_entropy.c` | Shannon-entropy password strength meter | Why bcrypt + strong passphrases are required by MedNexus's registration validator |
| `audit_chain.c` | Tamper-evident hash chain over a CSV audit log | The audit-log integrity concept implemented in the API (Appendix A of README) |
| `token_bucket.c` | Token-bucket rate limiter simulation | MedNexus's express-rate-limit login throttle |
| `input_filter.c` | Length + character-class input filter | Server-side Zod validation of dates, reasons and IDs |

## Build & run

```bash
# Option 1: make
make            # builds all four binaries into ./bin
make run        # runs each utility once with sample input

# Option 2: plain gcc
gcc -O2 -Wall -Wextra -o password_entropy.exe password_entropy.c   # Windows (MinGW)
gcc -O2 -Wall -Wextra -o password_entropy     password_entropy.c   # Linux / macOS
```

(Use `.exe` on Windows/MinGW, no extension elsewhere. `make` detects the platform automatically.)

## Sample session

```bash
./bin/password_entropy "Tr0ub4dour&3"
# => entropy 40.3 bits, VERDICT: WEAK  (below MedNexus's 60-bit policy)

./bin/audit_chain audit_seed.csv
# => verifies each row's previousHash linkage and reports TAMPERED line numbers
```

`audit_seed.csv` is a synthetic example audit log (fake demo user IDs and actions) so the
chain utility can be demonstrated immediately. You can generate a fresh one:

```bash
./bin/audit_chain --sample > audit_seed.csv
./bin/audit_chain audit_seed.csv        # VERDICT: VALID
# edit any byte in the file, rerun, and it reports the exact tampered line
```

## Security notes

* C string handling in these tools is bounded (`snprintf`, explicit `MAX_*` caps, `fgets`) to avoid
  the classic overflow pitfalls — the tools are themselves demonstrations of defensive coding.
* None of these tools access the network, the database, or the filesystem outside the single CSV
  argument you pass them.
* The **authoritative** security controls (bcrypt hashing, JWT, RBAC, rate limiting, audit logging)
  live in the `server/` JavaScript codebase; these C programs are educational companions.

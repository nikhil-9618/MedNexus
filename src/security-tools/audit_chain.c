/*
 * audit_chain.c — tamper-evident hash chain over a CSV audit log.
 *
 * Optional security DEMO for MedNexus (Build Secure 24). The API stores an
 * append-only AuditLog collection; this utility demonstrates the same idea
 * cryptographically: each row embeds hash(prevHash || row) so any edit,
 * deletion or reordering breaks the chain and is reported with its line.
 *
 * Usage:
 *   ./audit_chain audit_seed.csv        verify an existing log
 *   ./audit_chain --sample > file.csv   generate a fresh synthetic sample log
 *
 * This is an educational FNV-1a demo chain, NOT a substitute for an HMAC.
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_LINE 1024
#define HASH_STR 32 /* 16 hex chars + NUL */

typedef unsigned int u32;

static void fnv1a_hex(const char *data, size_t len, char out[HASH_STR]) {
    u32 h = 2166136261u;
    for (size_t i = 0; i < len; i++) {
        h ^= (unsigned char)data[i];
        h *= 16777619u;
    }
    u32 h2 = h ^ 0x9e3779b9u; /* second lane for 32 hex bits */
    snprintf(out, HASH_STR, "%08x%08x", h, h2);
}

static int verify_file(const char *path) {
    FILE *f = fopen(path, "r");
    if (!f) { fprintf(stderr, "error: cannot open %s\n", path); return 2; }

    char line[MAX_LINE];
    char prev[HASH_STR] = "GENESIS";
    char expected[HASH_STR];
    char payload[MAX_LINE + HASH_STR];
    int lineno = 0, valid = 1;

    while (fgets(line, sizeof(line), f)) {
        lineno++;
        line[strcspn(line, "\r\n")] = '\0';
        if (line[0] == '\0' || line[0] == '#') continue; /* skip blanks/comments */

        /* CSV row format: seq,timestamp,action,prevHash */
        char *first = strchr(line, ',');
        char *second = first ? strchr(first + 1, ',') : NULL;
        char *third = second ? strchr(second + 1, ',') : NULL;
        if (!first || !second || !third) {
            printf("LINE %d: MALFORMED row\n", lineno);
            valid = 0;
            continue;
        }
        *third = '\0';
        const char *stored = third + 1;          /* 4th field = stored hash */
        snprintf(payload, sizeof(payload), "%s|%s|%s|%s",
                 line, first + 1, second + 1, prev);

        fnv1a_hex(payload, strlen(payload), expected);
        if (strcmp(expected, stored) != 0) {
            printf("LINE %d: TAMPERED (stored %s, expected %s)\n", lineno, stored, expected);
            valid = 0;
        }
        /* chain continues with the STORED hash so a broken link is detectable */
        strncpy(prev, stored, HASH_STR);
    }
    fclose(f);

    if (lineno == 0) { printf("EMPTY LOG\n"); return 2; }
    printf("%s: %d rows checked — %s\n", path, lineno, valid ? "VERDICT: VALID (chain intact)" : "VERDICT: TAMPERED");
    return valid ? 0 : 1;
}

static void gen_sample(void) {
    const char *rows[] = {
        "LOGIN", "VIEW_MEDICAL_RECORD", "BOOK_APPOINTMENT",
        "FAILED_LOGIN", "ADMIN_USER_UPDATE", "LOGOUT",
    };
    char prev[HASH_STR] = "GENESIS";
    char expected[HASH_STR];
    char payload[MAX_LINE + HASH_STR];
    int seq = 1001;
    unsigned long ts = 1760000000UL;

    puts("# MedNexus synthetic audit chain sample (demo data only)");
    for (size_t i = 0; i < sizeof(rows) / sizeof(rows[0]); i++) {
        char actor[16];
        snprintf(actor, sizeof(actor), "%s", (i % 2 == 0) ? "P1004" : "D1001");
        snprintf(payload, sizeof(payload), "%d,%lu,%s(%s)|%s", seq, ts + i * 60, rows[i], actor, prev);
        fnv1a_hex(payload, strlen(payload), expected);
        printf("%d,%lu,%s(%s),%s\n", seq, ts + i * 60, rows[i], actor, expected);
        strncpy(prev, expected, HASH_STR);
        seq++;
    }
}

int main(int argc, char **argv) {
    if (argc > 1 && strcmp(argv[1], "--sample") == 0) { gen_sample(); return 0; }
    if (argc < 2) {
        fprintf(stderr, "usage: %s <audit.csv> | --sample\n", argv[0]);
        return 2;
    }
    return verify_file(argv[1]);
}

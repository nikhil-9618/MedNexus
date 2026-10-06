/*
 * input_filter.c — strict length + character-class input filter.
 *
 * Optional security DEMO for MedNexus (Build Secure 24). MedNexus validates
 * every API payload server-side with Zod (emails, ISO dates, HH:MM slots,
 * bounded free text). This tool demonstrates the same reject-by-default
 * discipline in C against MedNexus-style field rules.
 *
 * Rules implemented:
 *   email   : <=120 chars, no spaces/control chars, exactly one '@', domain dot
 *   date    : YYYY-MM-DD with real calendar check (leap years included)
 *   time    : HH:MM 24h with range check
 *   reason  : 5..300 printable chars, no control bytes
 *
 * Usage: echo "2026-10-06" | ./input_filter date
 */
#include <stdio.h>
#include <string.h>
#include <ctype.h>

#define MAX_INPUT 512

static int is_leap(int y) { return (y % 4 == 0 && y % 100 != 0) || y % 400 == 0; }

static int check_email(const char *s) {
    size_t len = strlen(s);
    if (len < 5 || len > 120) return 0;
    int ats = 0, dots_after = 0;
    for (size_t i = 0; s[i]; i++) {
        unsigned char c = (unsigned char)s[i];
        if (isspace(c) || iscntrl(c)) return 0;
        if (c == '@') ats++;
        if (c == '.' && ats > 0) dots_after = 1;
    }
    return ats == 1 && dots_after;
}

static int check_date(const char *s) {
    if (strlen(s) != 10 || s[4] != '-' || s[7] != '-') return 0;
    for (int i = 0; i < 10; i++) {
        if (i == 4 || i == 7) continue;
        if (!isdigit((unsigned char)s[i])) return 0;
    }
    int y = (s[0]-'0')*1000 + (s[1]-'0')*100 + (s[2]-'0')*10 + (s[3]-'0');
    int m = (s[5]-'0')*10 + (s[6]-'0');
    int d = (s[8]-'0')*10 + (s[9]-'0');
    if (m < 1 || m > 12 || d < 1) return 0;
    int dim[] = {31,28,31,30,31,30,31,31,30,31,30,31};
    if (m == 2 && is_leap(y)) dim[1] = 29;
    return d <= dim[m-1];
}

static int check_time(const char *s) {
    if (strlen(s) != 5 || s[2] != ':') return 0;
    if (!isdigit((unsigned char)s[0]) || !isdigit((unsigned char)s[1])) return 0;
    if (!isdigit((unsigned char)s[3]) || !isdigit((unsigned char)s[4])) return 0;
    int h = (s[0]-'0')*10 + (s[1]-'0');
    int m = (s[3]-'0')*10 + (s[4]-'0');
    return h <= 23 && m <= 59;
}

static int check_reason(const char *s) {
    size_t len = strlen(s);
    if (len < 5 || len > 300) return 0;
    for (size_t i = 0; s[i]; i++) {
        unsigned char c = (unsigned char)s[i];
        if (iscntrl(c)) return 0;
    }
    return 1;
}

int main(int argc, char **argv) {
    if (argc < 2) {
        fprintf(stderr, "usage: echo <value> | %s [email|date|time|reason]\n", argv[0]);
        return 2;
    }
    char input[MAX_INPUT];
    if (!fgets(input, sizeof(input), stdin)) return 2;
    input[strcspn(input, "\r\n")] = '\0';

    const char *field = argv[1];
    int ok;
    if      (strcmp(field, "email") == 0)  ok = check_email(input);
    else if (strcmp(field, "date") == 0)   ok = check_date(input);
    else if (strcmp(field, "time") == 0)   ok = check_time(input);
    else if (strcmp(field, "reason") == 0) ok = check_reason(input);
    else { fprintf(stderr, "unknown field: %s\n", field); return 2; }

    printf("%-7s %-28s -> %s\n", field, input, ok ? "ACCEPTED" : "REJECTED (400)");
    return ok ? 0 : 1;
}

/*
 * password_entropy.c — Shannon-entropy password strength meter.
 *
 * Optional security DEMO for MedNexus (Build Secure 24). Standalone C;
 * not linked into the web application. Mirrors why MedNexus's server-side
 * password policy (8+ chars, mixed case, digit, bcrypt-hashed) exists.
 *
 * Usage: ./password_entropy "Tr0ub4dour&3"
 *        (no argument -> reads one line from stdin)
 */
#include <stdio.h>
#include <string.h>
#include <math.h>
#include <ctype.h>

#define MAX_LEN 256

/* Character-class pool sizes used for entropy estimation. */
static size_t pool_size(const char *pw) {
    size_t pool = 0;
    int has_lower = 0, has_upper = 0, has_digit = 0, has_symbol = 0;
    for (; *pw; pw++) {
        if (islower((unsigned char)*pw)) has_lower = 1;
        else if (isupper((unsigned char)*pw)) has_upper = 1;
        else if (isdigit((unsigned char)*pw)) has_digit = 1;
        else has_symbol = 1;
    }
    if (has_lower)  pool += 26;
    if (has_upper)  pool += 26;
    if (has_digit)  pool += 10;
    if (has_symbol) pool += 33;
    return pool;
}

/* Shannon entropy (bits) of the string itself, over observed bytes. */
static double shannon_entropy(const char *pw) {
    int counts[256] = {0};
    size_t len = strlen(pw);
    if (len == 0) return 0.0;
    for (size_t i = 0; i < len; i++) counts[(unsigned char)pw[i]]++;
    double h = 0.0;
    for (int i = 0; i < 256; i++) {
        if (counts[i] == 0) continue;
        double p = (double)counts[i] / (double)len;
        h -= p * (log(p) / log(2.0));
    }
    return h * (double)len;
}

int main(int argc, char **argv) {
    char pw[MAX_LEN];

    if (argc > 1) {
        strncpy(pw, argv[1], MAX_LEN - 1);
        pw[MAX_LEN - 1] = '\0';
    } else if (fgets(pw, MAX_LEN, stdin)) {
        pw[strcspn(pw, "\r\n")] = '\0';
    } else {
        fprintf(stderr, "usage: %s \"password\"\n", argv[0]);
        return 2;
    }

    size_t len = strlen(pw);
    size_t pool = pool_size(pw);
    double bits = (pool > 0) ? (double)len * log2((double)pool) : 0.0;
    double shannon = shannon_entropy(pw);

    const char *verdict;
    if (bits >= 100)      verdict = "EXCELLENT";
    else if (bits >= 80)  verdict = "STRONG";
    else if (bits >= 60)  verdict = "MODERATE";
    else if (bits >= 40)  verdict = "WEAK";
    else                  verdict = "VERY WEAK";

    printf("password length     : %zu\n", len);
    printf("character pool      : %zu symbols\n", pool);
    printf("guess-space entropy : %.1f bits\n", bits);
    printf("shannon entropy     : %.1f bits\n", shannon);
    printf("verdict             : %s\n", verdict);
    printf("mednexus policy     : needs >= 60 bits (8+ chars, upper+lower+digit)\n");
    printf("overall             : %s\n", bits >= 60.0 ? "PASS" : "FAIL");
    return bits >= 60.0 ? 0 : 1;
}

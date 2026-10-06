/*
 * token_bucket.c — token-bucket rate limiter simulation.
 *
 * Optional security DEMO for MedNexus (Build Secure 24). MedNexus enforces
 * express-rate-limit on /api/auth (25 failed attempts / 15 min) and globally.
 * This tool lets you replay the same policy offline and see throttling work.
 *
 * Usage: ./token_bucket [capacity] [refill_per_sec] [requests...]
 *   ./token_bucket 5 1 1 1 1 1 1 1 1
 *     -> bucket of 5 tokens refilling 1/sec; timestamps are simulated ms gaps.
 * Requests are the millisecond gaps between calls (what the server "sees").
 */
#include <stdio.h>
#include <stdlib.h>

static double bucket;      /* current tokens */
static double capacity;    /* bucket size    */
static double refill_rate; /* tokens per second */

static int allow(double elapsed_seconds) {
    bucket += elapsed_seconds * refill_rate;
    if (bucket > capacity) bucket = capacity;
    if (bucket >= 1.0) { bucket -= 1.0; return 1; } /* token consumed */
    return 0;
}

int main(int argc, char **argv) {
    capacity   = (argc > 1) ? atof(argv[1]) : 5.0;
    refill_rate = (argc > 2) ? atof(argv[2]) : 1.0;
    if (capacity <= 0) capacity = 1.0;
    if (refill_rate <= 0) refill_rate = 1.0;
    bucket = capacity; /* start full */

    printf("token bucket: capacity=%.0f refill=%.1f/s (mirrors MedNexus auth limiter)\n",
           capacity, refill_rate);
    puts("--------------------------------------------------------------");

    double now_ms = 0.0;
    int n_req = 0;
    for (int i = 3; i < argc; i++) {
        double gap = atof(argv[i]);
        if (gap < 0) gap = 0;
        now_ms += gap;
        n_req++;
        int ok = allow(gap / 1000.0);
        printf("request %2d at t=%7.0f ms : %s (%.2f tokens left)\n",
               n_req, now_ms, ok ? "ALLOWED" : "429 THROTTLED", bucket);
    }

    if (n_req == 0) {
        puts("(pass request gaps in ms as arguments, e.g.: ./token_bucket 5 1 0 0 0 0 0 0)");
    }
    return 0;
}

# Makefile for MedNexus security-tools (optional C demos)
# These utilities are NOT part of the web application.

CC      ?= gcc
CFLAGS  ?= -O2 -Wall -Wextra -std=c99
BINS    = password_entropy audit_chain token_bucket input_filter
EXT     =

# Windows (MinGW) builds binaries with .exe
ifeq ($(OS),Windows_NT)
  EXT = .exe
endif

all: $(BINS)

password_entropy$(EXT): password_entropy.c
	$(CC) $(CFLAGS) -o $@ $< -lm

audit_chain$(EXT): audit_chain.c
	$(CC) $(CFLAGS) -o $@ $<

token_bucket$(EXT): token_bucket.c
	$(CC) $(CFLAGS) -o $@ $<

input_filter$(EXT): input_filter.c
	$(CC) $(CFLAGS) -o $@ $<

run: all
	./password_entropy$(EXT) "Tr0ub4dour&3"
	./password_entropy$(EXT) "Correct-Horse-Battery-9"
	./audit_chain$(EXT) --sample > audit_seed.csv
	./audit_chain$(EXT) audit_seed.csv
	./token_bucket$(EXT) 5 1 0 0 0 0 0 0 1000 1000
	echo "someone@example.com" | ./input_filter$(EXT) email
	echo "2026-13-40" | ./input_filter$(EXT) date
	echo "10:30" | ./input_filter$(EXT) time

clean:
	rm -f $(BINS)$(EXT) audit_seed.csv

.PHONY: all run clean

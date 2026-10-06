CREATE TABLE "account_profiles" (
	"identity_id" text PRIMARY KEY,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"dob" text NOT NULL,
	"gender" text NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"blood_group" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

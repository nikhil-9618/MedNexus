import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const accountProfiles = pgTable('account_profiles', {
  identityId: text('identity_id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  dob: text('dob').notNull(),
  gender: text('gender').notNull(),
  address: text('address').notNull().default(''),
  bloodGroup: text('blood_group').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

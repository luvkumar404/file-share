import { pgTable, serial, varchar, boolean, timestamp, integer, text } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial().primaryKey(),
  email: varchar({ length: 255 }).notNull().unique(),
  hashed_password: varchar({ length: 255 }).notNull(),
  is_active: boolean().notNull().default(true),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const files = pgTable("files", {
  id: serial().primaryKey(),
  owner_id: integer()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  original_filename: varchar({ length: 255 }).notNull(),
  stored_filename: varchar({ length: 255 }).notNull(),
  extension: varchar({ length: 20 }).notNull(),
  content_type: varchar({ length: 100 }),
  size_bytes: integer().notNull(),
  cloudinary_public_id: varchar({ length: 500 }).notNull(),
  cloudinary_resource_type: varchar({ length: 50 }).notNull(),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const shareLinks = pgTable("share_links", {
  id: serial().primaryKey(),
  file_id: integer()
    .notNull()
    .references(() => files.id, { onDelete: "cascade" }),
  token: varchar({ length: 255 }).notNull().unique(),
  password_hash: varchar({ length: 255 }),
  expires_at: timestamp({ withTimezone: true }).notNull(),
  is_revoked: boolean().notNull().default(false),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const accessLogs = pgTable("access_logs", {
  id: serial().primaryKey(),
  user_id: integer().references(() => users.id),
  file_id: integer(),
  action: varchar({ length: 50 }).notNull(),
  ip_address: varchar({ length: 100 }),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

// Server-generated secrets (e.g. the JWT signing key when JWT_SECRET_KEY isn't configured).
export const appSecrets = pgTable("app_secrets", {
  name: varchar({ length: 100 }).primaryKey(),
  value: text().notNull(),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;

CREATE TABLE "access_logs" (
	"id" serial PRIMARY KEY,
	"user_id" integer,
	"file_id" integer,
	"action" varchar(50) NOT NULL,
	"ip_address" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_secrets" (
	"name" varchar(100) PRIMARY KEY,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" serial PRIMARY KEY,
	"owner_id" integer NOT NULL,
	"original_filename" varchar(255) NOT NULL,
	"stored_filename" varchar(255) NOT NULL,
	"extension" varchar(20) NOT NULL,
	"content_type" varchar(100),
	"size_bytes" integer NOT NULL,
	"cloudinary_public_id" varchar(500) NOT NULL,
	"cloudinary_resource_type" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_links" (
	"id" serial PRIMARY KEY,
	"file_id" integer NOT NULL,
	"token" varchar(255) NOT NULL UNIQUE,
	"password_hash" varchar(255),
	"expires_at" timestamp with time zone NOT NULL,
	"is_revoked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY,
	"email" varchar(255) NOT NULL UNIQUE,
	"hashed_password" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_owner_id_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_file_id_files_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE;
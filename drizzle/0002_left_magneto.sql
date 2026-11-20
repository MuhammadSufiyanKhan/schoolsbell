ALTER TABLE "students" ADD COLUMN "guardian_name" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "guardian_phone" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "guardian_cnic" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "cnic" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "specializations" jsonb DEFAULT '[]'::jsonb NOT NULL;
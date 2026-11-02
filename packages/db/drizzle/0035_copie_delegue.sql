CREATE TABLE "pickup_secret" (
	"code_id" uuid PRIMARY KEY NOT NULL,
	"sealed" text,
	"copied_to" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pickup_secret" ADD CONSTRAINT "pickup_secret_code_id_pickup_code_id_fk" FOREIGN KEY ("code_id") REFERENCES "public"."pickup_code"("id") ON DELETE cascade ON UPDATE no action;
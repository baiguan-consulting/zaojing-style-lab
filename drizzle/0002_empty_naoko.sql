CREATE TABLE "nowpay_consumptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"out_request_no" text NOT NULL,
	"product_id" text NOT NULL,
	"external_buyer_id" text NOT NULL,
	"amount" integer NOT NULL,
	"consume_reason" text NOT NULL,
	"status" text DEFAULT 'PREPARED' NOT NULL,
	"consumed" integer,
	"remaining" integer,
	"provider_code" text,
	"provider_sub_code" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nowpay_purchase_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"out_request_no" text NOT NULL,
	"product_id" text NOT NULL,
	"sku_id" text,
	"external_buyer_id" text NOT NULL,
	"status" text DEFAULT 'CREATED' NOT NULL,
	"remaining_before" integer,
	"option_snapshot" jsonb,
	"expires_at" timestamp with time zone,
	"returned_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generation_tasks" ADD COLUMN "result_urls" jsonb;--> statement-breakpoint
ALTER TABLE "generation_tasks" ADD COLUMN "error_message" text;--> statement-breakpoint
ALTER TABLE "nowpay_consumptions" ADD CONSTRAINT "nowpay_consumptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nowpay_consumptions" ADD CONSTRAINT "nowpay_consumptions_task_id_generation_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."generation_tasks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nowpay_purchase_requests" ADD CONSTRAINT "nowpay_purchase_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "nowpay_consumptions_out_request_unique" ON "nowpay_consumptions" USING btree ("out_request_no");--> statement-breakpoint
CREATE UNIQUE INDEX "nowpay_consumptions_task_unique" ON "nowpay_consumptions" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "nowpay_consumptions_user_created_idx" ON "nowpay_consumptions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "nowpay_purchase_requests_out_request_unique" ON "nowpay_purchase_requests" USING btree ("out_request_no");--> statement-breakpoint
CREATE INDEX "nowpay_purchase_requests_user_created_idx" ON "nowpay_purchase_requests" USING btree ("user_id","created_at");
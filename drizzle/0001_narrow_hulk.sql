ALTER TABLE "payment_events" ADD COLUMN "provider_trade_no" text;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "completed_at" timestamp with time zone;
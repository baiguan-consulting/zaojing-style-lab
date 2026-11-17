CREATE TABLE "creator_earning_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_user_id" uuid NOT NULL,
	"generation_task_id" uuid,
	"template_id" text,
	"type" text NOT NULL,
	"delta_fen" integer NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"idempotency_key" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creator_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"terms_accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creator_withdrawals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount_fen" integer NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"payee_name_encrypted" text NOT NULL,
	"alipay_account_encrypted" text NOT NULL,
	"payee_name_masked" text NOT NULL,
	"alipay_account_masked" text NOT NULL,
	"contact_email" text NOT NULL,
	"review_note" text,
	"transfer_reference" text,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reward_credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"delta_credits" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"idempotency_key" text NOT NULL,
	"reference_type" text,
	"reference_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reward_credit_wallets" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"balance_credits" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generation_tasks" ADD COLUMN "funding_source" text DEFAULT 'LEGACY' NOT NULL;--> statement-breakpoint
ALTER TABLE "generation_tasks" ADD COLUMN "template_owner_user_id" uuid;--> statement-breakpoint
ALTER TABLE "generation_tasks" ADD COLUMN "creator_reward_fen" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "generation_tasks" ADD COLUMN "reward_credits_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "creator_earning_ledger" ADD CONSTRAINT "creator_earning_ledger_creator_user_id_users_id_fk" FOREIGN KEY ("creator_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_earning_ledger" ADD CONSTRAINT "creator_earning_ledger_generation_task_id_generation_tasks_id_fk" FOREIGN KEY ("generation_task_id") REFERENCES "public"."generation_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_profiles" ADD CONSTRAINT "creator_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_withdrawals" ADD CONSTRAINT "creator_withdrawals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_credit_ledger" ADD CONSTRAINT "reward_credit_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_credit_wallets" ADD CONSTRAINT "reward_credit_wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "creator_earning_ledger_idempotency_unique" ON "creator_earning_ledger" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "creator_earning_ledger_user_available_idx" ON "creator_earning_ledger" USING btree ("creator_user_id","available_at");--> statement-breakpoint
CREATE INDEX "creator_earning_ledger_task_idx" ON "creator_earning_ledger" USING btree ("generation_task_id");--> statement-breakpoint
CREATE INDEX "creator_withdrawals_user_created_idx" ON "creator_withdrawals" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "creator_withdrawals_status_created_idx" ON "creator_withdrawals" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reward_credit_ledger_idempotency_unique" ON "reward_credit_ledger" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "reward_credit_ledger_user_created_idx" ON "reward_credit_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "generation_tasks" ADD CONSTRAINT "generation_tasks_template_owner_user_id_users_id_fk" FOREIGN KEY ("template_owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
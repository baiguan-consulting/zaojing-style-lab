import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: text("status").notNull().default("ACTIVE"),
  displayName: text("display_name"),
  locale: text("locale").notNull().default("zh-CN"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  ...timestamps(),
});

export const authIdentities = pgTable(
  "auth_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    identifier: text("identifier").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("auth_identities_type_identifier_unique").on(table.type, table.identifier),
    index("auth_identities_user_id_idx").on(table.userId),
  ],
);

export const otpChallenges = pgTable(
  "otp_challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channel: text("channel").notNull(),
    purpose: text("purpose").notNull(),
    destinationHash: text("destination_hash").notNull(),
    codeHash: text("code_hash").notNull(),
    requestIpHash: text("request_ip_hash").notNull(),
    deliveryStatus: text("delivery_status").notNull().default("PENDING"),
    providerRequestId: text("provider_request_id"),
    attemptCount: integer("attempt_count").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("otp_challenges_destination_created_idx").on(table.destinationHash, table.createdAt),
    index("otp_challenges_ip_created_idx").on(table.requestIpHash, table.createdAt),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    ipHash: text("ip_hash").notNull(),
    userAgentHash: text("user_agent_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export const wallets = pgTable("wallets", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  balanceCredits: integer("balance_credits").notNull().default(0),
  ...timestamps(),
});

export const walletLedger = pgTable(
  "wallet_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    type: text("type").notNull(),
    deltaCredits: integer("delta_credits").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    referenceType: text("reference_type"),
    referenceId: uuid("reference_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("wallet_ledger_idempotency_key_unique").on(table.idempotencyKey),
    index("wallet_ledger_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const paymentOrders = pgTable(
  "payment_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    provider: text("provider").notNull().default("ALIPAY"),
    outTradeNo: text("out_trade_no").notNull(),
    providerTradeNo: text("provider_trade_no"),
    packageId: text("package_id").notNull(),
    subject: text("subject").notNull(),
    amountFen: integer("amount_fen").notNull(),
    credits: integer("credits").notNull(),
    refundedFen: integer("refunded_fen").notNull().default(0),
    status: text("status").notNull().default("CREATED"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("payment_orders_out_trade_no_unique").on(table.outTradeNo),
    index("payment_orders_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const paymentEvents = pgTable(
  "payment_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").references(() => paymentOrders.id, { onDelete: "set null" }),
    provider: text("provider").notNull(),
    providerEventId: text("provider_event_id").notNull(),
    providerTradeNo: text("provider_trade_no"),
    eventType: text("event_type").notNull(),
    payloadHash: text("payload_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("payment_events_provider_event_unique").on(table.provider, table.providerEventId)],
);

export const refunds = pgTable(
  "refunds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").notNull().references(() => paymentOrders.id, { onDelete: "restrict" }),
    outRequestNo: text("out_request_no").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    amountFen: integer("amount_fen").notNull(),
    creditsReserved: integer("credits_reserved").notNull(),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("PREPARED"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("refunds_out_request_no_unique").on(table.outRequestNo),
    uniqueIndex("refunds_order_idempotency_unique").on(table.orderId, table.idempotencyKey),
  ],
);

export const generationTasks = pgTable(
  "generation_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    templateId: text("template_id").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    requestedCount: integer("requested_count").notNull(),
    successfulCount: integer("successful_count").notNull().default(0),
    resultUrls: jsonb("result_urls").$type<string[]>(),
    errorMessage: text("error_message"),
    fundingSource: text("funding_source").notNull().default("LEGACY"),
    templateOwnerUserId: uuid("template_owner_user_id").references(() => users.id, { onDelete: "set null" }),
    creatorRewardFen: integer("creator_reward_fen").notNull().default(0),
    rewardCreditsUsed: integer("reward_credits_used").notNull().default(0),
    status: text("status").notNull().default("CREATED"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [index("generation_tasks_user_created_idx").on(table.userId, table.createdAt)],
);

export const creatorProfiles = pgTable("creator_profiles", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  bio: text("bio").notNull().default(""),
  status: text("status").notNull().default("ACTIVE"),
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }).notNull().defaultNow(),
  ...timestamps(),
});

export const creatorEarningLedger = pgTable(
  "creator_earning_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    creatorUserId: uuid("creator_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    generationTaskId: uuid("generation_task_id").references(() => generationTasks.id, { onDelete: "set null" }),
    templateId: text("template_id"),
    type: text("type").notNull(),
    deltaFen: integer("delta_fen").notNull(),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
    idempotencyKey: text("idempotency_key").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("creator_earning_ledger_idempotency_unique").on(table.idempotencyKey),
    index("creator_earning_ledger_user_available_idx").on(table.creatorUserId, table.availableAt),
    index("creator_earning_ledger_task_idx").on(table.generationTaskId),
  ],
);

export const rewardCreditWallets = pgTable("reward_credit_wallets", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  balanceCredits: integer("balance_credits").notNull().default(0),
  ...timestamps(),
});

export const rewardCreditLedger = pgTable(
  "reward_credit_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    type: text("type").notNull(),
    deltaCredits: integer("delta_credits").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    referenceType: text("reference_type"),
    referenceId: uuid("reference_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("reward_credit_ledger_idempotency_unique").on(table.idempotencyKey),
    index("reward_credit_ledger_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const creatorWithdrawals = pgTable(
  "creator_withdrawals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    amountFen: integer("amount_fen").notNull(),
    status: text("status").notNull().default("PENDING"),
    payeeNameEncrypted: text("payee_name_encrypted").notNull(),
    alipayAccountEncrypted: text("alipay_account_encrypted").notNull(),
    payeeNameMasked: text("payee_name_masked").notNull(),
    alipayAccountMasked: text("alipay_account_masked").notNull(),
    contactEmail: text("contact_email").notNull(),
    reviewNote: text("review_note"),
    transferReference: text("transfer_reference"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    index("creator_withdrawals_user_created_idx").on(table.userId, table.createdAt),
    index("creator_withdrawals_status_created_idx").on(table.status, table.createdAt),
  ],
);

export const nowpayPurchaseRequests = pgTable(
  "nowpay_purchase_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    outRequestNo: text("out_request_no").notNull(),
    productId: text("product_id").notNull(),
    skuId: text("sku_id"),
    externalBuyerId: text("external_buyer_id").notNull(),
    status: text("status").notNull().default("CREATED"),
    remainingBefore: integer("remaining_before"),
    optionSnapshot: jsonb("option_snapshot").$type<Record<string, unknown>>(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    returnedAt: timestamp("returned_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("nowpay_purchase_requests_out_request_unique").on(table.outRequestNo),
    index("nowpay_purchase_requests_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const nowpayConsumptions = pgTable(
  "nowpay_consumptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    taskId: uuid("task_id").notNull().references(() => generationTasks.id, { onDelete: "restrict" }),
    outRequestNo: text("out_request_no").notNull(),
    productId: text("product_id").notNull(),
    externalBuyerId: text("external_buyer_id").notNull(),
    amount: integer("amount").notNull(),
    consumeReason: text("consume_reason").notNull(),
    status: text("status").notNull().default("PREPARED"),
    consumed: integer("consumed"),
    remaining: integer("remaining"),
    providerCode: text("provider_code"),
    providerSubCode: text("provider_sub_code"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("nowpay_consumptions_out_request_unique").on(table.outRequestNo),
    uniqueIndex("nowpay_consumptions_task_unique").on(table.taskId),
    index("nowpay_consumptions_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const generationReservations = pgTable(
  "generation_reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    taskId: uuid("task_id").references(() => generationTasks.id, { onDelete: "set null" }),
    templateId: text("template_id").notNull(),
    reservedCredits: integer("reserved_credits").notNull(),
    settledCredits: integer("settled_credits"),
    status: text("status").notNull().default("RESERVED"),
    ...timestamps(),
  },
  (table) => [index("generation_reservations_user_created_idx").on(table.userId, table.createdAt)],
);

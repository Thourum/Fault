import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { drizzle } from 'drizzle-orm/node-postgres'
import { ok, err, retry, Fault, ServiceError } from '@thourum/fault'
import { safeDb } from '@thourum/fault/drizzle'
import { safeFetchJSON } from '@thourum/fault/fetch'
import { safeZodParse } from '@thourum/fault/zod'

declare const Sentry: { captureException: (e: unknown, ctx?: unknown) => void }
declare const logger: { info: (msg: string, data?: unknown) => void }
declare const stripeKey: string
const hash = (s: string) => Bun.hash(s).toString(16)

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  stripeId: text('stripe_id').notNull(),
  paidAt: timestamp('paid_at'),
})
const db = drizzle(process.env.DATABASE_URL ?? '', { schema: { users } })

Fault.onCapture = (fault) => Sentry.captureException(fault, { extra: fault.toJSON() })

const paymentIntentSchema = z.object({ id: z.string(), status: z.enum(["succeeded", "requires_action", "failed"]) })

export function chargeUser(userId: string, amountCents: number) {
  return retry(
    () => safeDb(db.query.users.findFirst({ where: eq(users.id, userId) })),
    { times: 3, delayMs: 200, when: (f) => f.tag === "CONNECTION_ERROR" },   // never retry constraint/logic failures
  )
    .andThen((user) => (user ? ok(user) : err(ServiceError("NOT_FOUND", `user ${userId} not found`))))
    .andThen((user) => (user.paidAt ? err(ServiceError("CONFLICT", "already paid")) : ok(user)))
    .andThen((user) =>
      safeFetchJSON("https://api.stripe.com/v1/payment_intents", {
        method: "POST",
        headers: { Authorization: `Bearer ${stripeKey}` },
        body: new URLSearchParams({ amount: String(amountCents), currency: "eur", customer: user.stripeId }),
      })
        .andThen(safeZodParse(paymentIntentSchema))
        .map((intent) => ({ user, intent })),
    )
    .andThen(({ user, intent }) =>
      intent.status === "failed"
        ? err(ServiceError("PAYMENT_FAILED", "stripe declined").withMetadata({ intentId: intent.id }))
        : ok({ user, intent }),
    )
    .andInspect(({ user, intent }) =>
      logger.info("payment ok", { userId: hash(user.id), intent: intent.id, amountCents }),
    )
    .mapErr((fault) => fault.withMetadata({ userId: hash(userId), amountCents }))
    .orInspect((fault) => fault.capture())
}

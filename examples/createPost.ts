import { z } from 'zod'
import { pgTable, text, serial } from 'drizzle-orm/pg-core'
import { drizzle } from 'drizzle-orm/node-postgres'
import { retry, fromPromise, ServiceError } from '@thourum/fault'
import { safeDb } from '@thourum/fault/drizzle'
import { safeFetch } from '@thourum/fault/fetch'
import { safeZodParse } from '@thourum/fault/zod'

declare const logger: { warn: (msg: string, data?: unknown) => void }
declare const bucket: string
declare const webhookUrl: string
declare const s3: { send: (cmd: unknown) => Promise<{ $metadata: { requestId?: string } }> }
declare class PutObjectCommand { constructor(input: { Bucket: string; Key: string; Body: unknown }) }
const hash = (s: string) => Bun.hash(s).toString(16)

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  authorId: text('author_id').notNull(),
  text: text('text').notNull(),
  imageKey: text('image_key').notNull(),
})
const db = drizzle(process.env.DATABASE_URL ?? '', { schema: { posts } })

const postInput = z.object({ text: z.string().min(1).max(5000), file: z.instanceof(File) })

const uploadToS3 = (file: File) => {
  const key = crypto.randomUUID()
  return fromPromise(
    s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: file.stream() })),
    (e) => ServiceError("EXTERNAL_ERROR", "s3 upload failed").withCause(e),
  )
    .orInspect((f) => logger.warn("upload failed", { tag: f.tag }))   // only S3 failures reach this
    .map(() => key)
}

export function createPost(authorId: string, raw: unknown) {
  return safeZodParse(postInput, raw)
    .asyncAndThen(({ text, file }) => uploadToS3(file).map((imageKey) => ({ text, imageKey })))
    .andThen(({ text, imageKey }) =>
      safeDb(db.insert(posts).values({ authorId, text, imageKey }).returning()).map((rows) => rows[0]!),
    )
    .andCheck((post) =>
      retry(
        () => safeFetch(webhookUrl, { method: "POST", body: JSON.stringify({ event: "post.created", id: post.id }) }),
        { times: 5, delayMs: 500, when: (f) => f.tag === "NETWORK_ERROR" || f.tag === "INTERNAL_ERROR" },
      ),
    )
    .mapErr((fault) => fault.withMetadata({ authorId: hash(authorId) }))
    .orInspect((fault) => fault.capture())
}

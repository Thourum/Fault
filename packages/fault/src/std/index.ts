import { readFile, writeFile } from 'node:fs/promises'
import { Result, ok, err } from '../result'
import { ResultAsync } from '../result-async'
import { Fault, type FaultTag } from '../fault'

const parseFault = (e: unknown, what: string) =>
    new Fault(e instanceof Error ? e : String(e)).withTag('PARSE_ERROR').withDetails(what).withCause(e)

export function safeJsonParse<T = unknown>(text: string): Result<T, Fault> {
    return Result.fromThrowable(() => JSON.parse(text) as T, (e) => parseFault(e, 'JSON.parse failed'))()
}

export function safeJsonStringify(value: unknown, space?: number): Result<string, Fault> {
    return Result.fromThrowable(
        () => {
            const s = JSON.stringify(value, null, space)
            if (s === undefined) throw new TypeError('value is not JSON serialisable')
            return s
        },
        (e) => parseFault(e, 'JSON.stringify failed'),
    )()
}

const FS_TAGS: Record<string, FaultTag> = { ENOENT: 'NOT_FOUND', EACCES: 'FORBIDDEN', EPERM: 'FORBIDDEN' }

const fsFault = (path: string) => (e: unknown): Fault => {
    const code = (e as { code?: string }).code ?? 'UNKNOWN'
    return new Fault(e instanceof Error ? e : String(e))
        .withTag(FS_TAGS[code] ?? 'INTERNAL_ERROR')
        .withMetadata({ code, path })
        .withCause(e)
}

export function safeReadFile(path: string, encoding: BufferEncoding = 'utf8'): ResultAsync<string, Fault> {
    return ResultAsync.fromPromise(readFile(path, { encoding }), fsFault(path))
}

export function safeWriteFile(path: string, data: string | Uint8Array): ResultAsync<void, Fault> {
    return ResultAsync.fromPromise(writeFile(path, data), fsFault(path))
}

export function safeEnv(name: string): Result<string, Fault> {
    const v = process.env[name]
    if (v === undefined || v === '') {
        return err(new Fault(`Missing environment variable ${name}`).withTag('CONFIGURATION_ERROR').withMetadata({ name }))
    }
    return ok(v)
}

import { errAsync, okAsync, ResultAsync } from '../result-async';
import { Fault, type FaultTag } from '../fault';

const tagForStatus = (status: number): FaultTag => {
    if (status === 400) return 'BAD_REQUEST';
    if (status === 401) return 'UNAUTHORIZED';
    if (status === 403) return 'FORBIDDEN';
    if (status === 404) return 'NOT_FOUND';
    if (status === 429) return 'RATE_LIMITED';
    if (status >= 500) return 'INTERNAL_ERROR';
    return 'BAD_REQUEST';
};

/**
 * Safely perform a fetch request, returning a ResultAsync type
 *
 * Wraps the native fetch API to return a ResultAsync instead of throwing errors.
 * Handles network errors, HTTP error responses, and JSON parsing errors.
 * Categorizes errors into appropriate Fault tags for precise error handling.
 *
 * @template T - The expected type of the response data
 * @param input - URL or string to fetch
 * @param init - Optional RequestInit options (headers, method, body, etc.)
 * @returns ResultAsync<T, Fault> - Either the parsed response or a Fault error
 *
 * @example Basic GET request
 * import { safeFetch } from '@itterno/fault'
 *
 * const result = await safeFetch<{ id: number; name: string }>('https://api.example.com/users/1')
 *
 * result.match(
 *   (user) => console.log('User:', user),
 *   (fault) => console.error('Error:', fault.message)
 * )
 *
 * @example POST with JSON body
 * const result = await safeFetch<{ id: number }>(
 *   'https://api.example.com/users',
 *   {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ name: 'John', email: 'john@example.com' })
 *   }
 * )
 *
 * result.match(
 *   (newUser) => console.log('Created:', newUser.id),
 *   (fault) => {
 *     if (fault.tag === 'VALIDATION_ERROR') {
 *       console.error('Invalid input:', fault.details)
 *     } else if (fault.tag === 'NETWORK_ERROR') {
 *       console.error('Network issue:', fault.message)
 *     }
 *   }
 * )
 *
 * @example Chaining with Zod validation
 * import { safeZodParse, okAsync } from '@itterno/fault'
 * import { z } from 'zod'
 *
 * const userSchema = z.object({
 *   id: z.number(),
 *   name: z.string(),
 *   email: z.string().email()
 * })
 *
 * const fetchAndValidateUser = (userId: number) =>
 *   safeFetch<unknown>(`https://api.example.com/users/${userId}`)
 *     .andThen((data) => safeZodParse(userSchema, data).asyncAndThen((user) => okAsync(user)))
 *
 * @example Error handling with status codes
 * const result = await safeFetch('https://api.example.com/data')
 *
 * result.match(
 *   (data) => console.log('Success:', data),
 *   (fault) => {
 *     switch (fault.tag) {
 *       case 'VALIDATION_ERROR': // 4xx client errors
 *         console.error('Client error:', fault.metadata.httpStatus)
 *         break
 *       case 'NOT_FOUND': // 404 specifically
 *         console.error('Resource not found')
 *         break
 *       case 'INTERNAL_ERROR': // 5xx server errors
 *         console.error('Server error:', fault.metadata.httpStatus)
 *         break
 *       case 'NETWORK_ERROR':
 *         console.error('Network error:', fault.message)
 *         break
 *       case 'PARSE_ERROR':
 *         console.error('Invalid response:', fault.message)
 *         break
 *     }
 *   }
 * )
 *
 * @example With error capture
 * const result = await safeFetch('https://api.example.com/data')
 *
 * result.match(
 *   (data) => console.log('Success:', data),
 *   (fault) => {
 *     // Capture to OpenTelemetry or Sentry if available
 *     fault.capture()
 *     throw fault
 *   }
 * )
 *
 * @example Response metadata access
 * const result = await safeFetch<{ message: string }>('https://api.example.com/data')
 *
 * result.match(
 *   (data) => console.log(data.message),
 *   (fault) => {
 *     // Access response headers
 *     const headers = fault.metadata.httpHeaders as Record<string, string> | undefined
 *     const contentType = headers?.['content-type']
 *
 *     // Access response body
 *     const body = fault.metadata.httpBody
 *
 *     // Access status code
 *     const status = fault.metadata.httpStatus as number | undefined
 *   }
 * )
 *
 * @see safeZodParse - For validating API responses
 * @see Fault - For error handling patterns
 */
export function safeFetch<T = unknown>(
    input: URL | string,
    init?: RequestInit
): ResultAsync<T, Fault> {
    return ResultAsync.fromPromise(fetch(input, init), (error: unknown): Fault => {
        const err = error instanceof Error ? error : new Error(String(error));
        return new Fault(err)
            .withTag('NETWORK_ERROR')
            .withDescription(
                'Network request failed',
                'Unable to connect to the server. Please check your internet connection.'
            )
            .withCause(err);
    }).andThen((response: Response) => {
        if (!response.ok) {
            return ResultAsync.fromSafePromise(response.text()).andThen((text) => {
                let httpBody: unknown = text;
                try {
                    httpBody = JSON.parse(text);
                } catch {
                    // keep raw text as httpBody
                }

                const headersObj: Record<string, string> = {};
                response.headers.forEach((value: string, key: string) => {
                    headersObj[key] = value;
                });

                return errAsync(
                    new Fault(`HTTP ${response.status}: ${response.statusText}`)
                        .withTag(tagForStatus(response.status))
                        .withMetadata({
                            httpStatus: response.status,
                            httpStatusText: response.statusText,
                            httpHeaders: headersObj,
                            httpBody,
                        })
                );
            });
        }

        return ResultAsync.fromSafePromise(response.text()).andThen((text) => {
            const isJson = (response.headers.get('content-type') ?? '').includes(
                'application/json'
            );
            if (response.status === 204 || !isJson || text === '') {
                return okAsync(undefined as T);
            }
            try {
                return okAsync(JSON.parse(text) as T);
            } catch (error: unknown) {
                const err = error instanceof Error ? error : new Error(String(error));
                return errAsync(
                    new Fault(err)
                        .withTag('PARSE_ERROR')
                        .withDescription(
                            'Failed to parse response',
                            'The server returned an invalid response. Please try again.'
                        )
                        .withCause(err)
                );
            }
        });
    });
}

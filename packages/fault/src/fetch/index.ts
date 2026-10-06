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

const networkFault = (error: unknown): Fault => {
    const err = error instanceof Error ? error : new Error(String(error));
    if (err.name === 'TimeoutError') {
        return new Fault(err)
            .withTag('TIMEOUT_ERROR')
            .withDescription('Network request timed out', 'The request timed out.')
            .withCause(err);
    }
    if (err.name === 'AbortError') {
        return new Fault(err)
            .withTag('ABORTED')
            .withDescription('Network request aborted', 'The request was aborted.')
            .withCause(err);
    }
    return new Fault(err)
        .withTag('NETWORK_ERROR')
        .withDescription(
            'Network request failed',
            'Unable to connect to the server. Please check your internet connection.'
        )
        .withCause(err);
};

/**
 * Fetch a response without consuming its body. Non-2xx responses become tagged
 * Faults with status, headers and a JSON-parsed (when possible) or text body in metadata.
 * Network failures, timeouts and aborts become distinct tagged Faults.
 *
 * @param input - URL or string to fetch
 * @param init - Optional RequestInit options
 * @returns The native Response or a Fault
 *
 * @example
 * const result = await safeFetch('https://api.example.com/data')
 * result.match((response) => response.text(), (fault) => console.error(fault.tag))
 */
export function safeFetch(input: URL | string, init?: RequestInit): ResultAsync<Response, Fault> {
    return ResultAsync.fromThrowable(fetch, networkFault)(input, init).andThen((response) => {
        if (response.ok) return okAsync(response);

        return ResultAsync.fromThrowable(() => response.text(), networkFault)().andThen((text) => {
            let httpBody: unknown = text;
            try {
                httpBody = JSON.parse(text);
            } catch {
                // Keep raw text as httpBody.
            }

            return errAsync(
                new Fault(`HTTP ${response.status}: ${response.statusText}`)
                    .withTag(tagForStatus(response.status))
                    .withMetadata({
                        httpStatus: response.status,
                        httpStatusText: response.statusText,
                        httpHeaders: Object.fromEntries(response.headers),
                        httpBody,
                    })
            );
        });
    });
}

/**
 * Fetch and parse a successful response as JSON, regardless of content type.
 * Empty or malformed bodies become PARSE_ERROR Faults with the HTTP status in metadata.
 * HTTP and network errors are returned by safeFetch without attempting success parsing.
 *
 * @template T - Expected JSON data shape
 * @param input - URL or string to fetch
 * @param init - Optional RequestInit options
 * @returns Parsed JSON or a Fault
 *
 * @example
 * const result = await safeFetchJSON<{ id: number }>('https://api.example.com/users/1')
 */
export function safeFetchJSON<T = unknown>(
    input: URL | string,
    init?: RequestInit
): ResultAsync<T, Fault> {
    return safeFetch(input, init).andThen((response) =>
        ResultAsync.fromThrowable(() => response.text(), networkFault)().andThen((text) => {
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
                        .withMetadata({ httpStatus: response.status })
                );
            }
        })
    );
}

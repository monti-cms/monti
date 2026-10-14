/**
 * What a stubbed `fetch` answers in the admin screen tests: the parts of a `Response` the admin client reads (`ok`, `status`, `json()`).
 * `vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(body)))`; a status of 400 or more makes it an error answer.
 */
export const jsonResponse = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });

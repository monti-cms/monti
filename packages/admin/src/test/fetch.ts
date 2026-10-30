/**
 * What a stubbed `fetch` answers: the parts of a `Response` the admin client reads (`ok`, `status`, `json()`). Admin tests use `fake-api.ts` instead;
 * this stays only for the AI package's tests until they move to a fake of their own routes (step 5 of `docs/testing/plan.md`).
 */
export const jsonResponse = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });

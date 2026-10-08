/**
 * Finds entries of one collection by title, for a picker (a relation field): `collection`, `query` (title, then slug), `locale`, `publishedOnly`
 * and `limit` (default 20, at most 50). The best matches come first. Answers `{ items: [{ id, title, slug, status }] }` and nothing else, so a picker
 * loads only the entries it shows. With `id` (repeat it) the entries are looked up by id instead, so a picker can show the titles of its values.
 */
export declare const GET: (request: Request, context?: Partial<import("../../handler.js").RouteContext<{
    [x: string]: string;
}>> | undefined) => Promise<Response>;

import { adminRoute, ok } from "../handler";

/**
 * Collection definitions (`schemas` and the summarized v1-shaped `definitions`), body block definitions (`blocks`), and server limits (§5.6 "the server config and
 * API metadata show the same limits"). The field character limit is the field's `max` in `schemas` (the title too). The operation `site.describe`.
 */
export const GET = adminRoute(async ({ cms, auth }) => ok(await cms.runOperation("site.describe", {}, { auth })));

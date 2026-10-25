import { adminRoute, ok } from "../../../handler";

/**
 * What publishing the saved draft would find, without publishing: `issues` block a publish and `warnings` do not, each with its text and place like the
 * ones the publish route returns. It runs the same checks as the publish (hooks, core preparation, the checks against the rows a publish locks) and changes
 * nothing, so it takes no `expectedVersion`. It is guarded as publish is, and refuses an entry that cannot be published (trashed, archived) the same way.
 * The operation `entries.checkPublish`.
 */
export const POST = adminRoute<{ id: string }>(async ({ params, cms, auth }) =>
	ok(await cms.runOperation("entries.checkPublish", { id: params.id }, { auth })),
);

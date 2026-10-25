import { adminRoute, ok } from "../../../handler";

/** Where this entry is used (back references). Distinguishes draft and published usages. The operation `entries.usages`. */
export const GET = adminRoute<{ id: string }>(async ({ params, cms, auth }) =>
	ok(await cms.runOperation("entries.usages", { id: params.id }, { auth })),
);

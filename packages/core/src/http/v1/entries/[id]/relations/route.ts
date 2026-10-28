import { adminRoute, ok } from "../../../handler";

/**
 * Where this entry is used (back references). Distinguishes draft and published usages. `?includeTrashed=true` also lists the entries in the trash that refer to it
 * (each item has a `sourceStatus`). The operation `entries.usages`.
 */
export const GET = adminRoute<{ id: string }>(async ({ request, params, cms, auth }) => {
	const includeTrashed = ["true", "1"].includes(new URL(request.url).searchParams.get("includeTrashed") ?? "");
	return ok(
		await cms.runOperation(
			"entries.usages",
			{ id: params.id, ...(includeTrashed ? { includeTrashed } : {}) },
			{ auth },
		),
	);
});

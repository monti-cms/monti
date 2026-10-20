import { planImport } from "../../../../services/entry-import/plan";
import { readImportArchive } from "../../../../services/entry-import/read-archive";
import { runImport } from "../../../../services/entry-import/run";
import { adminRoute, CmsError, ok } from "../../handler";
import { readImportUpload } from "../upload";
import { presentPlan, presentResults } from "./present";

/** The mapping field: a JSON object of archive collection name → target collection (or `null` to skip it). */
function readMapping(value: FormDataEntryValue | null): Record<string, string | null> {
	if (value === null || value === "") return {};
	let parsed: unknown;
	try {
		parsed = typeof value === "string" ? JSON.parse(value) : undefined;
	} catch {
		parsed = undefined;
	}
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		throw new CmsError("The mapping must be a JSON object of collection names", "invalid_input");
	}
	const mapping: Record<string, string | null> = {};
	for (const [name, target] of Object.entries(parsed)) {
		if (target !== null && typeof target !== "string") {
			throw new CmsError("The mapping must name a collection or null for each collection", "invalid_input");
		}
		mapping[name] = target;
	}
	return mapping;
}

/**
 * Imports entries from an uploaded zip into this site as new entries, through the normal write pipeline (admin only). The zip is an export of this
 * version, or a zip of `.md` / `.mdx` files with front matter. It brings in the title, slug and body of document collections; nothing else is read, and the answer
 * says what was left out. The upload is at most `limits.importBytes` of `/v1/meta` (413 above it).
 *
 * `multipart/form-data` fields:
 * - `file`: the zip.
 * - `mode`: `preview` (writes nothing, answers what would happen) or `run`.
 * - `mapping`: JSON, archive collection → document collection of this site, or `null` to skip it. A collection that is not listed goes to the collection of the same name.
 * - `publish`: `true` (with `run`) publishes the entries that were published in the archive once every body is saved.
 */
export const POST = adminRoute(async ({ request, cms }) => {
	const { form, bytes, mode } = await readImportUpload(request);

	const source = readImportArchive(bytes, {
		site: cms.site,
		formats: await cms.formats(),
	});
	const plan = await planImport(cms, source, readMapping(form.get("mapping")));
	if (mode === "preview") return ok(presentPlan(cms.site, plan));
	const results = await runImport(cms, plan, { publish: form.get("publish") === "true" });
	return ok(presentResults(cms.site, results));
});

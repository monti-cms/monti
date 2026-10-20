import type { Cms } from "../../../../cms";
import { exportOptionsSchema } from "../../../../core/api";
import { adminRoute, ok, parseWith, readJsonBody, readQuery } from "../../handler";
import { assertFormatInstalled, readExportPlan } from "../plan";

const summaryOf = async (cms: Cms, value: unknown) => {
	const options = parseWith(exportOptionsSchema, value, "Invalid export options");
	if (options.format !== undefined) await assertFormatInstalled(cms, options.format);
	return ok((await readExportPlan(cms, options)).summary);
};

/**
 * What an export with the same options (`scope`, `ids`, `format`) would hold, in counts: the entries (and how many of them are translations added to the
 * selection), the templates, folders, addresses and media records. Nothing is built. `POST` takes the options in the body, for a long list of `ids`.
 */
export const GET = adminRoute(async ({ request, cms }) => summaryOf(cms, readQuery(request)));

export const POST = adminRoute(async ({ request, cms }) => summaryOf(cms, await readJsonBody(request)));

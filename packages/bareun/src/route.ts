import { adminRoute, CmsError, handleTextCheck, ok, readJsonBody } from "@monti-cms/core/server";
import { checkWithBareun } from "./api";
import { readBareunOptions } from "./config";
import { bareunMessages } from "./messages";
import { BAREUN_KEY_SLOT } from "./options";

/**
 * Bareun check route (`POST /api/monti/v1/text-check/bareun`). Admin only. Takes `{ segments }` and returns `{ issues }`.
 * The settings are those of the Bareun plugin in the site config of the instance that serves the request.
 * Without a key it does not call Bareun and returns 503. Bareun errors are turned into a generic error (502) by the check route helper (`handleTextCheck`).
 */
export function bareunRoute() {
	const POST = adminRoute(async ({ request, cms, plugin }) => {
		const options = readBareunOptions(cms.site);
		// The key is read from the key slot on every call. It is never sent to the browser.
		const apiKey = (await plugin.key(BAREUN_KEY_SLOT).read())?.trim();
		if (!apiKey) {
			const t = cms.site.createTranslator(bareunMessages);
			throw new CmsError("No Bareun API key in the key slot", "service_unavailable", {
				notice: { what: t("error.keyMissing") },
			});
		}
		return ok(
			await handleTextCheck(
				await readJsonBody(request),
				{
					limits: options.limits,
					check: (segments, { signal }) =>
						checkWithBareun(cms.site, segments, {
							apiKey,
							baseUrl: options.baseUrl,
							customDictNames: options.customDictNames,
							signal,
						}),
				},
				request.signal,
			),
		);
	});
	return { POST };
}

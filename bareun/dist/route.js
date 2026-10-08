import { adminRoute, handleTextCheck, json, readJsonBody } from "@monti-cms/core/plugin/server";
import { checkWithBareun } from "./api.js";
import { readBareunOptions } from "./config.js";
import { bareunMessages } from "./messages.js";
/**
 * Bareun check route (`POST /api/cms/v1/text-check/bareun`). Admin only. Takes `{ segments }` and returns `{ issues }`.
 * The settings are those of the Bareun plugin in the site config of the instance that serves the request.
 * Without a key it does not call Bareun and returns 503. Bareun errors are turned into a generic error (502) by the check route helper (`handleTextCheck`).
 */
export function bareunRoute() {
    const POST = adminRoute(async ({ request, cms }) => {
        const options = readBareunOptions(cms.site);
        // The key is read from the server environment variable on every call. It is never sent to the browser.
        const apiKey = process.env[options.apiKeyEnv]?.trim() || undefined;
        if (!apiKey) {
            const t = cms.site.createTranslator(bareunMessages);
            return json({ code: "text_check_unavailable", message: t("error.keyMissing") }, { status: 503 });
        }
        const result = await handleTextCheck(await readJsonBody(request), {
            limits: options.limits,
            check: (segments, { signal }) => checkWithBareun(cms.site, segments, {
                apiKey,
                baseUrl: options.baseUrl,
                customDictNames: options.customDictNames,
                signal,
            }),
        }, request.signal);
        return json(result.body, { status: result.status });
    });
    return { POST };
}

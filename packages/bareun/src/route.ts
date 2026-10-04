import { createActiveTranslator } from "@monti-cms/core";
import { adminRoute, json, textCheckRoute } from "@monti-cms/core/plugin/server";
import { checkWithBareun } from "./api";
import { bareunMessages } from "./messages";
import type { ResolvedBareunOptions } from "./options";

const t = createActiveTranslator(bareunMessages);

/**
 * Bareun check route (`POST /api/cms/v1/text-check/bareun`). Admin only. Takes `{ segments }` and returns `{ issues }`.
 * Without a key it does not call Bareun and returns 503. Bareun errors are turned into a generic error (502) by the check route helper (`textCheckRoute`).
 */
export function bareunRoute(options: ResolvedBareunOptions) {
	// The key is read from the server environment variable on every call. It is never sent to the browser.
	const readKey = () => process.env[options.apiKeyEnv]?.trim() || undefined;
	const unavailable = adminRoute(async () =>
		json({ code: "text_check_unavailable", message: t("error.keyMissing") }, { status: 503 }),
	);
	const check = textCheckRoute({
		limits: options.limits,
		check: async (segments, { signal }) => {
			const apiKey = readKey();
			if (!apiKey) throw new Error("Bareun API key is missing");
			return checkWithBareun(segments, {
				apiKey,
				baseUrl: options.baseUrl,
				customDictNames: options.customDictNames,
				signal,
			});
		},
	});
	const POST: typeof check = (request, context) => (readKey() ? check : unavailable)(request, context);
	return { POST };
}

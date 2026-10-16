import type { TextCheckerLimits } from "@monti-cms/core";
import { createActiveTranslator, resolveTextCheckerLimits } from "@monti-cms/core";
import { bareunMessages } from "./messages";

// `bareun()` is called from the site config file, so the default name is chosen by display language at read time.
const t = createActiveTranslator(bareunMessages);

import { pluginError } from "@monti-cms/core/server";
import { BAREUN_PLUGIN_NAME } from "./name";

export { BAREUN_PLUGIN_NAME };

/** Id of the plugin's one API key slot. */
export const BAREUN_KEY_SLOT = "key";

/** Checker name (the source shown on results). */
export const BAREUN_CHECKER_ID = "bareun";

/** Server route. Appended to the core API base (`/api/monti/`). */
export const BAREUN_ROUTE = "v1/text-check/bareun";

export interface BareunOptions {
	/** Bareun API URL. Default `https://api.bareun.ai`. Change it to use a self-hosted Bareun server. */
	readonly baseUrl?: string;
	/** Toolbar button name and the source shown in the results panel. Defaults to "Bareun spell check" in the display language. */
	readonly label?: string;
	/** Automatically checks only changed paragraphs once typing stops. The Bareun API is billed by usage, so this is off by default. */
	readonly auto?: boolean;
	/** Names of custom dictionaries already uploaded to Bareun. */
	readonly customDictNames?: readonly string[];
	/** Paragraphs and characters per request. Default 100 paragraphs / 10,000 characters. Larger input is split. */
	readonly limits?: TextCheckerLimits;
}

export interface ResolvedBareunOptions {
	readonly baseUrl: string;
	readonly label: string;
	readonly auto: boolean;
	readonly customDictNames: readonly string[];
	readonly limits: TextCheckerLimits;
}

/** Bareun takes fewer characters per request than the route default. */
const DEFAULT_LIMITS = { maxSegments: 100, maxChars: 10_000 };

/** Fills in defaults and rejects invalid values. */
export function resolveBareunOptions(options: BareunOptions = {}): ResolvedBareunOptions {
	const baseUrl = (options.baseUrl ?? "https://api.bareun.ai").replace(/\/+$/, "");
	if (!/^https?:\/\//.test(baseUrl)) throw pluginError(BAREUN_PLUGIN_NAME, `baseUrl must be an http(s) URL`);
	const limits = resolveTextCheckerLimits(options.limits, DEFAULT_LIMITS, "bareun");
	const label = options.label?.trim();
	return {
		baseUrl,
		get label() {
			return label || t("label");
		},
		auto: options.auto ?? false,
		customDictNames: [...(options.customDictNames ?? [])],
		limits,
	};
}

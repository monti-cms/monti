import type { TextCheckerLimits } from "@monti-cms/core";
import { createActiveTranslator } from "@monti-cms/core";
import { bareunMessages } from "./messages";

// `bareun()` is called from the site config file, so the default name is chosen by display language at read time.
const t = createActiveTranslator(bareunMessages);

/** Name used to find the Bareun checker in the site config `plugins`. */
export const BAREUN_PLUGIN_NAME = "text-check-bareun";

/** Checker name (the source shown on results). */
export const BAREUN_CHECKER_ID = "bareun";

/** Server route. Appended to the core API base (`/api/cms/`). */
export const BAREUN_ROUTE = "v1/text-check/bareun";

export interface BareunOptions {
	/** Name of the environment variable holding the API key. Default `BAREUN_API_KEY`. The key is read on the server only. */
	readonly apiKeyEnv?: string;
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
	readonly apiKeyEnv: string;
	readonly baseUrl: string;
	readonly label: string;
	readonly auto: boolean;
	readonly customDictNames: readonly string[];
	readonly limits: TextCheckerLimits;
}

const DEFAULT_LIMITS: TextCheckerLimits = { maxSegments: 100, maxChars: 10_000 };

/** Fills in defaults and rejects invalid values. */
export function resolveBareunOptions(options: BareunOptions = {}): ResolvedBareunOptions {
	const apiKeyEnv = options.apiKeyEnv ?? "BAREUN_API_KEY";
	if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(apiKeyEnv)) throw new Error(`bareun: invalid apiKeyEnv "${apiKeyEnv}"`);
	const baseUrl = (options.baseUrl ?? "https://api.bareun.ai").replace(/\/+$/, "");
	if (!/^https?:\/\//.test(baseUrl)) throw new Error(`bareun: baseUrl must be an http(s) URL`);
	const limits = { ...DEFAULT_LIMITS, ...options.limits };
	for (const [key, value] of Object.entries(limits)) {
		if (value !== undefined && (!Number.isInteger(value) || value <= 0))
			throw new Error(`bareun: limits.${key} must be a positive integer`);
	}
	const label = options.label?.trim();
	return {
		apiKeyEnv,
		baseUrl,
		get label() {
			return label || t("label");
		},
		auto: options.auto ?? false,
		customDictNames: [...(options.customDictNames ?? [])],
		limits,
	};
}

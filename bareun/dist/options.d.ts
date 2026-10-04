import type { TextCheckerLimits } from "@monti-cms/core";
/** Name used to find the Bareun checker in the site config `plugins`. */
export declare const BAREUN_PLUGIN_NAME = "text-check-bareun";
/** Checker name (the source shown on results). */
export declare const BAREUN_CHECKER_ID = "bareun";
/** Server route. Appended to the core API base (`/api/cms/`). */
export declare const BAREUN_ROUTE = "v1/text-check/bareun";
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
/** Fills in defaults and rejects invalid values. */
export declare function resolveBareunOptions(options?: BareunOptions): ResolvedBareunOptions;

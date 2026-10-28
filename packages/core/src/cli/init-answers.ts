import type { BLOCK_CHOICES } from "./block-choices";

/** What the questions of `monti init` decide, and the defaults they start from. */

/** Defaults `monti init` writes into a new config. */
export const DEFAULT_INIT_LOCALE = "en";
/** The time zone `monti init` falls back to when it cannot read the computer's (and the one it was before init followed the computer). */
export const DEFAULT_INIT_TIME_ZONE = "UTC";
/** The admin path `monti init` asks for and writes by default. */
export const DEFAULT_INIT_ADMIN_PATH = "/studio";

/** What the questions of `monti init` decided. Every field has a flag. */
export interface InitAnswers {
	/** Public URL of the site, for the `SITE_URL` example in `.env.example`. */
	readonly siteUrl: string;
	/** Locale codes, the default first. */
	readonly locales: readonly string[];
	readonly timeZone: string;
	/** Where `timeZone` came from: `--time-zone`, this computer, or UTC because the computer's time zone could not be read. */
	readonly timeZoneSource: "flag" | "computer" | "fallback";
	readonly storage: "none" | "s3";
	readonly ai: boolean;
	/** Ids of {@link BLOCK_CHOICES}. */
	readonly blocks: readonly string[];
	readonly adminPath: string;
	/** How people sign in to the admin: the built-in email and password login, or GitHub (an OAuth app). */
	readonly login: "password" | "github";
	/** Read and write `:::callout` blocks (`@monti-cms/syntax-directive`), because the posts use them. */
	readonly directiveSyntax: boolean;
}

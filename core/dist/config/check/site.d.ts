import type { CmsConfig } from "../define.js";
import { type IssueList } from "./issue.js";
/** The keys a site config has. A key outside the list is a typo or an option that does not exist. */
export declare const SITE_KEYS: readonly string[];
/** The site-wide settings: top-level keys, locales, site and admin options, time zone, the editor and the seed. */
export declare function checkSite(list: IssueList, config: CmsConfig, alsoKnown?: readonly string[]): void;

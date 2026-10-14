import { type ReactNode } from "react";
import type { CmsConfig } from "../config/define.js";
import type { Translator } from "../i18n/index.js";
import type { MessageBundle } from "../i18n/define.js";
import { type Site } from "./create-site.js";
export type SiteProviderProps = {
    readonly children: ReactNode;
} & ({
    /**
     * The site as data: what the server's `cms.site.snapshot()` returns (a server component hands it to this client component), or a plain site config in a test.
     * The site is created from it once per distinct object.
     */
    readonly config: CmsConfig;
    readonly site?: undefined;
} | {
    /** An already created site (`createSite(config)`), for code that has one and renders in the same environment. */
    readonly site: Site;
    readonly config?: undefined;
});
/**
 * Gives the components below it the site they work with: its collections, locales, blocks, addresses and admin language. The admin layout renders it from the instance
 * the server page passes (`@monti-cms/nextjs/admin`), so the browser never reads a config file.
 */
export declare function SiteProvider({ config, site, children }: SiteProviderProps): import("react").JSX.Element;
/** The site of the nearest {@link SiteProvider}. Throws outside one. */
export declare function useSite<Config extends CmsConfig = CmsConfig>(): Site<Config>;
/** A translator for one dictionary in the site's admin language, with the site's text overrides. The same function while the site does not change. */
export declare function useTranslator<K extends string>(bundle: MessageBundle<K>): Translator<K>;

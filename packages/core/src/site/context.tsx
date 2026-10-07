"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";
import type { Translator } from "../i18n";
import type { MessageBundle } from "../i18n/define";
import { type AnyCmsConfig, createSite, type Site } from "./create-site";

const SiteContext = createContext<Site | null>(null);

export type SiteProviderProps = { readonly children: ReactNode } & (
	| {
			/**
			 * The site as data: what the server's `cms.site.snapshot()` returns (a server component hands it to this client component), or a plain site config in a test.
			 * The site is created from it once per distinct object.
			 */
			readonly config: AnyCmsConfig;
			readonly site?: undefined;
	  }
	| {
			/** An already created site (`createSite(config)`), for code that has one and renders in the same environment. */
			readonly site: Site;
			readonly config?: undefined;
	  }
);

/**
 * Gives the components below it the site they work with: its collections, locales, blocks, addresses and admin language. The admin layout renders it from the instance
 * the server page passes (`@monti-cms/nextjs/admin`), so the browser never reads a config file.
 */
export function SiteProvider({ config, site, children }: SiteProviderProps) {
	const created = useMemo(() => site ?? createSite(config as AnyCmsConfig), [site, config]);
	return <SiteContext.Provider value={created}>{children}</SiteContext.Provider>;
}

/** The site of the nearest {@link SiteProvider}. Throws outside one. */
export function useSite<Config extends AnyCmsConfig = AnyCmsConfig>(): Site<Config> {
	const site = useContext(SiteContext);
	if (!site)
		throw new Error(
			"useSite() was called outside a <SiteProvider>. The admin layout renders one; a test wraps its tree in it.",
		);
	return site as Site<Config>;
}

/** A translator for one dictionary in the site's admin language, with the site's text overrides. The same function while the site does not change. */
export function useTranslator<K extends string>(bundle: MessageBundle<K>): Translator<K> {
	const site = useSite();
	return useMemo(() => site.createTranslator(bundle), [site, bundle]);
}

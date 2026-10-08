"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useMemo } from "react";
import { createSite } from "./create-site.js";
const SiteContext = createContext(null);
/**
 * Gives the components below it the site they work with: its collections, locales, blocks, addresses and admin language. The admin layout renders it from the instance
 * the server page passes (`@monti-cms/nextjs/admin`), so the browser never reads a config file.
 */
export function SiteProvider({ config, site, children }) {
    const created = useMemo(() => site ?? createSite(config), [site, config]);
    return _jsx(SiteContext.Provider, { value: created, children: children });
}
/** The site of the nearest {@link SiteProvider}. Throws outside one. */
export function useSite() {
    const site = useContext(SiteContext);
    if (!site)
        throw new Error("useSite() was called outside a <SiteProvider>. The admin layout renders one; a test wraps its tree in it.");
    return site;
}
/** A translator for one dictionary in the site's admin language, with the site's text overrides. The same function while the site does not change. */
export function useTranslator(bundle) {
    const site = useSite();
    return useMemo(() => site.createTranslator(bundle), [site, bundle]);
}

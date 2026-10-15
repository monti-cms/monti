"use client";
import { useCallback, useSyncExternalStore } from "react";
import { isSchemaTab } from "./tabs.js";
/**
 * Where the writer is on the Settings page: the tab (the last segment of the address) and, for the collections tab, the collection and the part of it that is open (`?collection=post&section=fields`).
 * The address is the one place that holds it, changed in place with the History API (no server round trip, so the unsaved draft stays), which is also what makes a reload after saving land on the same spot.
 */
const CHANGE_EVENT = "monti:settings-place";
const SCROLL_KEY = "monti.settings.scroll";
const subscribe = (listener) => {
    window.addEventListener("popstate", listener);
    window.addEventListener(CHANGE_EVENT, listener);
    return () => {
        window.removeEventListener("popstate", listener);
        window.removeEventListener(CHANGE_EVENT, listener);
    };
};
const snapshot = () => `${window.location.pathname}${window.location.search}`;
const serverSnapshot = () => "";
const announce = () => window.dispatchEvent(new Event(CHANGE_EVENT));
/** The tab named by the last segment of `pathname`, if it is one. */
export function tabOfPath(pathname) {
    const last = pathname.split("/").filter(Boolean).at(-1);
    return last !== undefined && isSchemaTab(last) ? last : undefined;
}
/** The address of `tab`: the current one with its last segment replaced, so a base path or a changed admin path carries over. The query stays, so the collection that was open is still open when the writer comes back. */
export function addressOfTab(pathname, search, tab) {
    const segments = pathname.split("/");
    segments[segments.length - 1] = tab;
    return `${segments.join("/")}${search}`;
}
/** The tab being shown: the one in the address, which moves without a navigation; `fallback` (the tab the page was rendered for) until the browser is there. */
export function useSettingsTab(fallback) {
    const place = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
    const tab = tabOfPath(place.split("?")[0] ?? "") ?? fallback;
    const go = useCallback((next) => {
        const target = addressOfTab(window.location.pathname, window.location.search, next);
        if (target === snapshot())
            return;
        window.history.pushState(window.history.state, "", target);
        announce();
    }, []);
    return { tab, go };
}
/** One query value of the address, and a setter that changes it in place (no new history entry: choosing a collection is not a page). `undefined` removes it. */
export function useSettingsParam(name) {
    const place = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
    const value = new URLSearchParams(place.split("?")[1] ?? "").get(name) ?? undefined;
    const set = useCallback((next) => {
        const url = new URL(window.location.href);
        if (next === undefined)
            url.searchParams.delete(name);
        else
            url.searchParams.set(name, next);
        const target = `${url.pathname}${url.search}`;
        if (target === snapshot())
            return;
        window.history.replaceState(window.history.state, "", target);
        announce();
    }, [name]);
    return [value, set];
}
/** Notes how far the page is scrolled, for the page that opens after the reload that follows a save. */
export function rememberScroll(top) {
    try {
        window.sessionStorage.setItem(SCROLL_KEY, JSON.stringify({ place: snapshot(), top }));
    }
    catch {
        // Storage can be unavailable: the reload still happens, only the scroll position is lost.
    }
}
/** The scroll position a save left for this very address, once. */
export function takeScroll() {
    try {
        const raw = window.sessionStorage.getItem(SCROLL_KEY);
        if (raw === null)
            return null;
        window.sessionStorage.removeItem(SCROLL_KEY);
        const saved = JSON.parse(raw);
        return saved.place === snapshot() && typeof saved.top === "number" ? saved.top : null;
    }
    catch {
        return null;
    }
}

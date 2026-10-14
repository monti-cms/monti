"use client";
import { useSite } from "@monti-cms/core/client";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { readPreference, removePreference, subscribePreferences, writePreference } from "../utils/site-storage.js";
export const stringCodec = { parse: (raw) => raw, serialize: (value) => value };
export const booleanCodec = {
    parse: (raw) => (raw === "1" ? true : raw === "0" ? false : undefined),
    serialize: (value) => (value ? "1" : "0"),
};
/** A positive number (a width in px). */
export const positiveNumberCodec = {
    parse: (raw) => {
        const value = Number(raw);
        return Number.isFinite(value) && value > 0 ? value : undefined;
    },
    serialize: String,
};
/** One of a fixed list of strings. */
export const enumCodec = (values) => ({
    parse: (raw) => values.find((value) => value === raw),
    serialize: (value) => value,
});
/**
 * A preference remembered in this browser, per site (a panel width, the media view, whether a pane is open). It is read through
 * `useSyncExternalStore`, so the first client render already has the stored value (no flash of the default), several components on one
 * preference stay in step, and a change in another tab arrives too. Unavailable storage means the default.
 *
 * Preferences that should follow the person to another device (list columns, sort, page size) are not stored here but on the server (`/v1/preferences`).
 *
 * `set(value)` remembers a value; `reset()` forgets it so the default applies again.
 */
export function usePreference(name, codec, defaultValue) {
    const site = useSite();
    const raw = useSyncExternalStore(subscribePreferences, () => readPreference(site, name), () => null);
    const value = useMemo(() => (raw === null ? undefined : codec.parse(raw)), [raw, codec]);
    const set = useCallback((next) => writePreference(site, name, codec.serialize(next)), [site, name, codec]);
    const reset = useCallback(() => removePreference(site, name), [site, name]);
    return [value ?? defaultValue, set, reset];
}

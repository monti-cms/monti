"use client";

import { useSite } from "@monti-cms/core/site";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { readPreference, removePreference, subscribePreferences, writePreference } from "../utils/site-storage";

/** How a preference becomes a string and back. `parse` returns `undefined` for a stored text that is not valid (the default is used then). */
export interface PreferenceCodec<T> {
	parse: (raw: string) => T | undefined;
	serialize: (value: T) => string;
}

export const stringCodec: PreferenceCodec<string> = { parse: (raw) => raw, serialize: (value) => value };

export const booleanCodec: PreferenceCodec<boolean> = {
	parse: (raw) => (raw === "1" ? true : raw === "0" ? false : undefined),
	serialize: (value) => (value ? "1" : "0"),
};

/** A positive number (a width in px). */
export const positiveNumberCodec: PreferenceCodec<number> = {
	parse: (raw) => {
		const value = Number(raw);
		return Number.isFinite(value) && value > 0 ? value : undefined;
	},
	serialize: String,
};

/** One of a fixed list of strings. */
export const enumCodec = <T extends string>(values: readonly T[]): PreferenceCodec<T> => ({
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
export function usePreference<T>(
	name: string,
	codec: PreferenceCodec<T>,
	defaultValue: T,
): readonly [value: T, set: (value: T) => void, reset: () => void] {
	const site = useSite();
	const raw = useSyncExternalStore(
		subscribePreferences,
		() => readPreference(site, name),
		() => null,
	);
	const value = useMemo(() => (raw === null ? undefined : codec.parse(raw)), [raw, codec]);
	const set = useCallback((next: T) => writePreference(site, name, codec.serialize(next)), [site, name, codec]);
	const reset = useCallback(() => removePreference(site, name), [site, name]);
	return [value ?? defaultValue, set, reset] as const;
}

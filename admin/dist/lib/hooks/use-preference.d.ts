/** How a preference becomes a string and back. `parse` returns `undefined` for a stored text that is not valid (the default is used then). */
export interface PreferenceCodec<T> {
    parse: (raw: string) => T | undefined;
    serialize: (value: T) => string;
}
export declare const stringCodec: PreferenceCodec<string>;
export declare const booleanCodec: PreferenceCodec<boolean>;
/** A positive number (a width in px). */
export declare const positiveNumberCodec: PreferenceCodec<number>;
/** One of a fixed list of strings. */
export declare const enumCodec: <T extends string>(values: readonly T[]) => PreferenceCodec<T>;
/**
 * A preference remembered in this browser, per site (a panel width, the media view, whether a pane is open). It is read through
 * `useSyncExternalStore`, so the first client render already has the stored value (no flash of the default), several components on one
 * preference stay in step, and a change in another tab arrives too. Unavailable storage means the default.
 *
 * Preferences that should follow the person to another device (list columns, sort, page size) are not stored here but on the server (`/v1/preferences`).
 *
 * `set(value)` remembers a value; `reset()` forgets it so the default applies again.
 */
export declare function usePreference<T>(name: string, codec: PreferenceCodec<T>, defaultValue: T): readonly [value: T, set: (value: T) => void, reset: () => void];

/**
 * The reads of the open screen that did not come back with their data (`useRead`), and the one way to make them all again. Every read
 * tells it how its last try went; the banner at the screen's top (`ReadFailedBanner`) shows while one failed, with "try again". So a screen
 * whose read is refused or gets no answer never stands empty with nothing said, whichever screen it is and whichever read.
 */
import type { Refusal } from "./use-operation";

type Failed = {
	refusal: Refusal;
	reload: () => Promise<unknown>;
	/** The screen says this one itself, in its own banner: the shared banner waits while it does. */
	own: boolean;
};

export type FailedReads = {
	/** A read's last try: failed with this, or (with `null`) came back, was left, or is no longer wanted. */
	set: (read: object, failed: Failed | null) => void;
	subscribe: (listener: () => void) => () => void;
	/** What the shared banner shows: nothing while no read failed or while a screen says its own; else the first failed read's refusal. */
	shown: () => Refusal | null;
	/** Makes every failed read again, the screens' own too. */
	retry: () => Promise<void>;
};

export function createFailedReads(): FailedReads {
	const failed = new Map<object, Failed>();
	const listeners = new Set<() => void>();
	let shown: Refusal | null = null;
	const settle = () => {
		const all = [...failed.values()];
		const next = all.some((each) => each.own) ? null : (all[0]?.refusal ?? null);
		if (next === shown) return;
		shown = next;
		for (const listener of listeners) listener();
	};
	return {
		set: (read, how) => {
			if (how) failed.set(read, how);
			else if (!failed.delete(read)) return;
			settle();
		},
		subscribe: (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		shown: () => shown,
		retry: async () => {
			await Promise.all([...failed.values()].map((each) => each.reload()));
		},
	};
}

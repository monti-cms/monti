"use client";

import { createContext, type ReactNode, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";

/** The kind of screen the admin is on. A custom page of a plugin, the schema, the event log and the like are `other`. */
export type AdminScreen = "entries" | "entry" | "media" | "settings" | "other";

/** Where the admin is, as a plugin's side panel reads it (`useScreenContext`). */
export interface ScreenContextValue {
	readonly screen: AdminScreen;
	/** The collection of a list or of the open entry. */
	readonly collection?: string;
	/** The entry open in the editor. */
	readonly entryId?: string;
	/** The rows selected in a list (`list.selectedIds` of the entry list); empty while none is. Only the entry list has it. */
	readonly selectedIds?: readonly string[];
}

const DEFAULT_VALUE: ScreenContextValue = { screen: "other" };

/**
 * What the screens published, merged: each screen part publishes the keys it knows (the shell the screen and collection, the list its selection), a later
 * publisher overriding an earlier one, and everything a part published goes away when it unmounts.
 */
class ScreenContextStore {
	private readonly layers = new Map<symbol, Partial<ScreenContextValue>>();
	private readonly listeners = new Set<() => void>();
	private value: ScreenContextValue = DEFAULT_VALUE;

	readonly subscribe = (listener: () => void) => {
		this.listeners.add(listener);
		return () => void this.listeners.delete(listener);
	};

	readonly get = () => this.value;

	set(key: symbol, part: Partial<ScreenContextValue>) {
		this.layers.set(key, part);
		this.update();
	}

	delete(key: symbol) {
		this.layers.delete(key);
		this.update();
	}

	private update() {
		const merged: { -readonly [K in keyof ScreenContextValue]?: ScreenContextValue[K] } = {};
		for (const part of this.layers.values()) {
			for (const [name, value] of Object.entries(part))
				if (value !== undefined) Object.assign(merged, { [name]: value });
		}
		const next: ScreenContextValue = { ...DEFAULT_VALUE, ...merged };
		// The same content keeps the same object, so a reader does not render again for a publish that changed nothing.
		if (JSON.stringify(next) === JSON.stringify(this.value)) return;
		this.value = next;
		for (const listener of this.listeners) listener();
	}
}

const ScreenContextStoreContext = createContext<ScreenContextStore | null>(null);

/** Holds what the screens publish about where the admin is. The admin root renders it once, around every screen and the side panel. */
export function ScreenContextProvider({ children }: { children: ReactNode }) {
	const [store] = useState(() => new ScreenContextStore());
	return <ScreenContextStoreContext.Provider value={store}>{children}</ScreenContextStoreContext.Provider>;
}

const NO_STORE = new ScreenContextStore();

/** Where the admin is now: the screen, its collection, the open entry and the selected rows of a list. `screen: "other"` outside any known screen. */
export function useScreenContext(): ScreenContextValue {
	const store = useContext(ScreenContextStoreContext) ?? NO_STORE;
	return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/** Publishes part of the screen context while the caller is mounted. Without the provider (a screen on its own) it does nothing. */
export function usePublishScreenContext(part: Partial<ScreenContextValue>): void {
	const store = useContext(ScreenContextStoreContext);
	const key = useRef(Symbol("screen-context"));
	const serialized = JSON.stringify(part);
	// biome-ignore lint/correctness/useExhaustiveDependencies: `serialized` is the identity of `part`
	useEffect(() => {
		store?.set(key.current, part);
	}, [store, serialized]);
	useEffect(() => {
		const id = key.current;
		return () => store?.delete(id);
	}, [store]);
}

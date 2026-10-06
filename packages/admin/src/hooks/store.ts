import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

/**
 * State store foundation for the editor hooks, built on zustand's vanilla store.
 * zustand types stay out of every public signature: this interface is the only shape hooks see, and `public.ts` exposes no store.
 */
export interface StateStore<S> {
	getState(): S;
	/** The state the store was created with. React reads it for the server render. */
	getInitialState(): S;
	/** Merges a partial state, or the partial returned from `update(state)`. */
	setState(update: Partial<S> | ((state: S) => Partial<S>)): void;
	subscribe(listener: (state: S, previous: S) => void): () => void;
}

export function createStateStore<S extends object>(initial: S): StateStore<S> {
	return createStore<S>(() => initial);
}

/**
 * Subscribes a component to one slice of a store. It re-renders only when the selected value changes (compared with `Object.is`),
 * so the selector must return a stable value (a field of the state, not a freshly built object).
 */
export function useStoreSelector<S extends object, T>(store: StateStore<S>, selector: (state: S) => T): T {
	return useStore(store, selector);
}

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

/**
 * For a store that mirrors props a provider receives. Writing the new props has to happen while the provider renders, so the children
 * that render in the same pass read current values (a controlled input that read the previous value for one pass would lose its caret).
 * That write cannot notify subscribers (React forbids updating other components while rendering), so it changes the current state in
 * place and returns whether any key changed. Call {@link notifyStateStore} from a layout effect after a change so the subscribers that
 * did not render in that pass re-check their slice.
 */
export function assignStateSilently<S extends object>(store: StateStore<S>, next: S): boolean {
	const state = store.getState();
	let changed = false;
	for (const key of Object.keys(next) as (keyof S)[]) {
		if (Object.is(state[key], next[key])) continue;
		state[key] = next[key];
		changed = true;
	}
	return changed;
}

/** Tells every subscriber to re-check its slice (see {@link assignStateSilently}). A selector keeps a component from re-rendering when its slice is unchanged. */
export function notifyStateStore<S extends object>(store: StateStore<S>): void {
	store.setState({});
}

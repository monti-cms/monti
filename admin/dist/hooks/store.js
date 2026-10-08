import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
export function createStateStore(initial) {
    return createStore(() => initial);
}
/**
 * Subscribes a component to one slice of a store. It re-renders only when the selected value changes (compared with `Object.is`),
 * so the selector must return a stable value (a field of the state, not a freshly built object).
 */
export function useStoreSelector(store, selector) {
    return useStore(store, selector);
}
/**
 * For a store that mirrors props a provider receives. Writing the new props has to happen while the provider renders, so the children
 * that render in the same pass read current values (a controlled input that read the previous value for one pass would lose its caret).
 * That write cannot notify subscribers (React forbids updating other components while rendering), so it changes the current state in
 * place and returns whether any key changed. Call {@link notifyStateStore} from a layout effect after a change so the subscribers that
 * did not render in that pass re-check their slice.
 */
export function assignStateSilently(store, next) {
    const state = store.getState();
    let changed = false;
    for (const key of Object.keys(next)) {
        if (Object.is(state[key], next[key]))
            continue;
        state[key] = next[key];
        changed = true;
    }
    return changed;
}
/** Tells every subscriber to re-check its slice (see {@link assignStateSilently}). A selector keeps a component from re-rendering when its slice is unchanged. */
export function notifyStateStore(store) {
    store.setState({});
}

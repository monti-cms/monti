/**
 * What stands docked at the bottom centre of a screen while it is shown (the proposal bubble). The toasts come up at the same place, so the
 * `Toaster` reads this and stands above it: nothing covers a control a person is about to press.
 */
const docked: HTMLElement[] = [];
const listeners = new Set<() => void>();
let shown: HTMLElement | null = null;

const told = () => {
	shown = docked.at(-1) ?? null;
	for (const listener of listeners) listener();
};

/** Says a dock is on the screen; the answer takes it off again. */
export function dock(node: HTMLElement): () => void {
	docked.push(node);
	told();
	return () => {
		docked.splice(docked.indexOf(node), 1);
		told();
	};
}

export function watchDock(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

/** The dock on the screen now (the last one shown, if two are), or none. */
export const dockShown = () => shown;

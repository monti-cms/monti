import type { EventListener, MontiEvent } from "./types";

/**
 * The subscribers of committed writes. `emit` calls each subscriber on its own and waits for none: a subscriber's
 * thrown error or failed promise changes neither the write's result nor the other subscribers. Handling its own
 * errors is the subscriber's job.
 */
export function createEvents() {
	const listeners = new Set<EventListener>();

	function onEvent(listener: EventListener): () => void {
		listeners.add(listener);
		return function off() {
			listeners.delete(listener);
		};
	}

	function emit(event: MontiEvent): void {
		for (const listener of [...listeners]) notify(listener, event);
	}

	return { onEvent, emit };
}

function notify(listener: EventListener, event: MontiEvent): void {
	try {
		Promise.resolve(listener(event)).catch(ignore);
	} catch {
		// The subscriber's own error: the core publishes and is done.
	}
}

function ignore(): void {}

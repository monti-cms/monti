import { useCallback, useEffect, useRef, useState } from "react";

/** The value follows only after it has not changed for `delay` ms. The first value is used immediately. Avoids sending many requests while typing. */
export function useDebounced<T>(value: T, delay: number): T {
	const [debounced, setDebounced] = useState(value);
	useEffect(() => {
		const timer = setTimeout(() => setDebounced(value), delay);
		return () => clearTimeout(timer);
	}, [value, delay]);
	return debounced;
}

/**
 * Text typed into a field whose value lives elsewhere (the address, a query): the field keeps its own text so typing is never delayed, and
 * `commit` is called with it once typing pauses. The text follows `committed` when that changes from outside (a cleared filter).
 */
export function useDebouncedInput(
	committed: string,
	commit: (text: string) => void,
	delay = 300,
): readonly [text: string, setText: (text: string) => void] {
	const [text, setText] = useState(committed);
	const commitRef = useRef(commit);
	commitRef.current = commit;
	useEffect(() => setText(committed), [committed]);
	useEffect(() => {
		if (text === committed) return;
		const timer = setTimeout(() => commitRef.current(text), delay);
		return () => clearTimeout(timer);
	}, [text, committed, delay]);
	return [text, setText] as const;
}

/**
 * A function that runs `delay` ms after its last call, with the arguments of that call (saving column widths after a drag stops). The latest `callback` is used,
 * and a call still waiting when the component unmounts is dropped.
 */
export function useDebouncedCallback<Args extends unknown[]>(
	callback: (...args: Args) => void,
	delay: number,
): (...args: Args) => void {
	const callbackRef = useRef(callback);
	callbackRef.current = callback;
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(
		() => () => {
			if (timer.current) clearTimeout(timer.current);
		},
		[],
	);
	return useCallback(
		(...args: Args) => {
			if (timer.current) clearTimeout(timer.current);
			timer.current = setTimeout(() => callbackRef.current(...args), delay);
		},
		[delay],
	);
}

import { useEffect, useRef, useState } from "react";

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

import { useEffect, useRef, useState } from "react";

/**
 * A list's search box, in every list (the entry list, the trash, the activity log): the box keeps its words while they are typed, and the address
 * follows a moment later, in place. `apply` puts the words in the address. `settle` is for a choice made beside the box (where to look): it stops
 * the wait and hands back the words still on their way, so they go with the choice and the wait cannot undo it.
 */
export function useSearchWords(search: string, apply: (words: string) => void) {
	const [words, setWords] = useState(search);
	const typing = useRef<ReturnType<typeof setTimeout> | null>(null);
	const latest = useRef(apply);
	latest.current = apply;
	useEffect(() => setWords(search), [search]);
	useEffect(
		() => () => {
			if (typing.current) clearTimeout(typing.current);
		},
		[],
	);
	const type = (text: string) => {
		setWords(text);
		if (typing.current) clearTimeout(typing.current);
		typing.current = setTimeout(() => latest.current(text), 250);
	};
	const settle = () => {
		if (typing.current) clearTimeout(typing.current);
		return words;
	};
	return { words, type, settle };
}

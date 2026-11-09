import { useEffect, useRef, useState } from "react";

/**
 * A text input inside a block of the editor. Its value lives in the document, and writing the document draws the block again, which breaks a word a Korean input method
 * is still composing (its letters pile up unjoined). So while a word is being composed the input keeps it itself, and the document gets it when it is done (T33, `korean`).
 */
export function useComposedValue(value: string, commit: (next: string) => void) {
	const [shown, setShown] = useState(value);
	const composing = useRef(false);
	const latest = useRef(value);
	useEffect(() => {
		if (composing.current) return;
		latest.current = value;
		setShown(value);
	}, [value]);
	return {
		value: shown,
		change: (next: string) => {
			latest.current = next;
			setShown(next);
			if (!composing.current) commit(next);
		},
		composition: {
			onCompositionStart: () => {
				composing.current = true;
			},
			onCompositionEnd: () => {
				composing.current = false;
				commit(latest.current);
			},
		},
	};
}

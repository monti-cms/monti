import { useCallback, useRef, useState } from "react";
import { type Filled, useQuickFill } from "./use-assistant";

/** One place a quick task fills, as its button and its line show it. */
export type FillState = {
	/** The model is being asked: the button says "writing…" and cannot be pressed again. */
	working: boolean;
	/** The value a fill put in, while the place still holds it: it is drawn blue, and the button says "again". */
	filled: unknown;
	/** Why the last fill gave nothing, for the line under the place. */
	failed: string | null;
};

const IDLE: FillState = { working: false, filled: undefined, failed: null };

/**
 * The "✦ fill" buttons of one screen (doc 10, quick tasks): which places are being filled, what each was filled with, and why one was not.
 * `undefined` on a site that cannot fill (no assistant, no key): no button is drawn. A place is named by the screen (`values.summary`,
 * `alt:<block>`); the answer goes where `put` says, as a value the person typed.
 */
export function useFills() {
	const fill = useQuickFill();
	const [states, setStates] = useState<Record<string, FillState>>({});
	// An answer that comes after its place was filled again (or the screen left) is nobody's.
	const asked = useRef<Record<string, number>>({});
	const change = useCallback(
		(place: string, next: Partial<FillState>) =>
			setStates((was) => ({ ...was, [place]: { ...(was[place] ?? IDLE), ...next } })),
		[],
	);
	const run = useCallback(
		async (place: string, input: Record<string, unknown>, put: (answer: Extract<Filled, { ok: true }>) => unknown) => {
			if (!fill) return;
			const turn = (asked.current[place] ?? 0) + 1;
			asked.current[place] = turn;
			change(place, { working: true, failed: null });
			const answer = await fill(input);
			if (asked.current[place] !== turn) return;
			if (answer.ok) change(place, { working: false, filled: put(answer), failed: null });
			else change(place, { working: false, failed: answer.why });
		},
		[fill, change],
	);
	/** The place was changed by hand: what the last fill said about it no longer stands. */
	const forget = useCallback(
		(place: string) =>
			setStates((was) => (was[place]?.failed ? { ...was, [place]: { ...was[place], failed: null } } : was)),
		[],
	);
	const of = useCallback((place: string): FillState => states[place] ?? IDLE, [states]);
	return fill ? { run, of, forget } : undefined;
}
export type Fills = NonNullable<ReturnType<typeof useFills>>;

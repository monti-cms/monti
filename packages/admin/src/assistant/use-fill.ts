import { useCallback, useEffect, useRef, useState } from "react";
import { useAdmin } from "../operations/admin-context";
import { type Filled, useQuickFill } from "./use-assistant";

/** One place a quick task fills, as its button and its line show it. */
export type FillState = {
	/** The model is being asked: the button gives way to "Generating · Stop". */
	working: boolean;
	/** The value a fill put in, while the place still holds it: it is drawn blue, and the button says "again". */
	filled: unknown;
	/** Why the last fill gave nothing, for the line under the place. */
	failed: string | null;
	/** The line under the place offers "Try again" (`canRetry`). */
	retry: boolean;
};

const IDLE: FillState = { working: false, filled: undefined, failed: null, retry: false };

type Put = (answer: Extract<Filled, { ok: true }>) => unknown;

/**
 * The "✦ fill" buttons of one screen (doc 10, quick tasks): which places are being filled, what each was filled with, and why one was not.
 * `undefined` on a site that cannot fill (no assistant, no key): no button is drawn. A place is named by the screen (`values.summary`,
 * `alt:<block>`); the answer goes where `put` says, as a value the person typed.
 */
export function useFills() {
	const fill = useQuickFill();
	const { t } = useAdmin();
	const [states, setStates] = useState<Record<string, FillState>>({});
	// An answer that comes after its place was filled again, was changed by hand, was stopped, or after the screen left, is nobody's.
	const asked = useRef<Record<string, number>>({});
	/** What each place was last asked with: what "Try again" asks again. */
	const last = useRef<Record<string, { input: Record<string, unknown>; put: Put }>>({});
	const gone = useRef(false);
	useEffect(() => {
		gone.current = false;
		return () => {
			gone.current = true;
		};
	}, []);
	const change = useCallback(
		(place: string, next: Partial<FillState>) =>
			setStates((was) => ({ ...was, [place]: { ...(was[place] ?? IDLE), ...next } })),
		[],
	);
	const run = useCallback(
		async (place: string, input: Record<string, unknown>, put: Put) => {
			if (!fill) return;
			const turn = (asked.current[place] ?? 0) + 1;
			asked.current[place] = turn;
			last.current[place] = { input, put };
			change(place, { working: true, failed: null, retry: false });
			const answer = await fill(input);
			if (gone.current || asked.current[place] !== turn) return;
			if (!answer.ok) return change(place, { working: false, failed: answer.why, retry: answer.retry });
			// Nothing came back (no value of the site fits, an empty answer): the place keeps what it had, and its line says so.
			const nothing = "values" in answer ? answer.values.length === 0 : answer.value.trim() === "";
			if (nothing) return change(place, { working: false, failed: t("fill.nothing"), retry: true });
			change(place, { working: false, filled: put(answer), failed: null });
		},
		[fill, change, t],
	);
	/** "Try again" under a place: the same fill as last time, as it was asked. */
	const again = useCallback(
		(place: string) => {
			const was = last.current[place];
			if (was) void run(place, was.input, was.put);
		},
		[run],
	);
	/**
	 * The place was changed by hand, or the fill was stopped: what the last fill said about it no longer stands, and an answer still on its
	 * way is not put in. The place keeps what it holds.
	 */
	const forget = useCallback((place: string) => {
		asked.current[place] = (asked.current[place] ?? 0) + 1;
		setStates((was) =>
			was[place]?.failed || was[place]?.working
				? { ...was, [place]: { ...was[place], failed: null, working: false } }
				: was,
		);
	}, []);
	const of = useCallback((place: string): FillState => states[place] ?? IDLE, [states]);
	return fill ? { run, again, of, forget } : undefined;
}
export type Fills = NonNullable<ReturnType<typeof useFills>>;

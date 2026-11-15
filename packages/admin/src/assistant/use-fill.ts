import { useCallback, useEffect, useRef, useState } from "react";
import { useAdmin } from "../operations/admin-context";
import { type Filled, useQuickFill } from "./use-assistant";

/** One place a quick task fills, as its button and its line show it. */
export type FillState = {
	/** The model is being asked: the button gives way to "Generating · Stop". */
	working: boolean;
	/**
	 * The value a fill put in, while it is the place's: it is drawn blue, and the line says "Discard · Again". It goes when the place is
	 * changed by hand or the fill is discarded; leaving or saving keeps it (doc 10, principle 1).
	 */
	filled: unknown;
	/** Why the last fill gave nothing, for the line under the place. */
	failed: string | null;
	/** The line under the place offers "Try again" (`canRetry`). */
	retry: boolean;
};

const IDLE: FillState = { working: false, filled: undefined, failed: null, retry: false };

/**
 * Puts a fill's answer in its place, as the place is when the answer comes. It gives what it put and how to put back what the place held
 * the moment before, or `null` when the place is no longer the one asked about (another picture) and nothing was put.
 */
export type Put = (answer: Extract<Filled, { ok: true }>) => { value: unknown; back: () => void } | null;

/** Undo (⌘Z, Ctrl+Z, not with Shift): in a place a fill wrote, it takes the fill back as one step, as the line's "Discard" does. */
export const isUndoKey = (event: {
	key: string;
	metaKey: boolean;
	ctrlKey: boolean;
	shiftKey: boolean;
	altKey: boolean;
}) => event.key.toLowerCase() === "z" && (event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey;

/**
 * The "✦ fill" buttons of one screen (doc 10, quick tasks): which places are being filled, what each was filled with, and why one was not.
 * `undefined` on a site that cannot fill (no assistant, no key): no button is drawn. A place is named by the screen (`values.summary`,
 * `alt:<block>`); the answer goes where `put` says, as a value the person typed. What the place held before the first of its fills is
 * kept, so "Discard" (or undo in the place) puts it back however many times "Again" was pressed since.
 */
export function useFills() {
	const fill = useQuickFill();
	const { t } = useAdmin();
	const [states, setStates] = useState<Record<string, FillState>>({});
	// An answer that comes after its place was filled again, was changed by hand, was stopped, or after the screen left, is nobody's.
	const asked = useRef<Record<string, number>>({});
	/** What each place was last asked with: what "Try again" asks again. */
	const last = useRef<Record<string, { input: Record<string, unknown>; put: Put }>>({});
	/** How to put back what each filled place held before its first fill. */
	const backs = useRef<Record<string, () => void>>({});
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
			const done = put(answer);
			if (!done) return change(place, { working: false });
			// "Again" over a fill still there: what goes back is what the place held before the first one.
			backs.current[place] ??= done.back;
			change(place, { working: false, filled: done.value, failed: null });
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
	/** "Stop": an answer still on its way is not put in. The place keeps what it holds, a fill already there included. */
	const stop = useCallback((place: string) => {
		asked.current[place] = (asked.current[place] ?? 0) + 1;
		setStates((was) => (was[place]?.working ? { ...was, [place]: { ...was[place], working: false } } : was));
	}, []);
	/**
	 * The place was changed by hand: what the last fill said about it no longer stands, an answer still on its way is not put in, and what
	 * it holds is the person's (no longer blue, nothing to discard).
	 */
	const forget = useCallback((place: string) => {
		asked.current[place] = (asked.current[place] ?? 0) + 1;
		delete backs.current[place];
		setStates((was) =>
			was[place] && (was[place].failed || was[place].working || was[place].filled !== undefined)
				? { ...was, [place]: IDLE }
				: was,
		);
	}, []);
	/** "Discard" on the line, or undo in the place: what the place held before its first fill goes back, as one step. */
	const discard = useCallback(
		(place: string) => {
			const back = backs.current[place];
			forget(place);
			back?.();
		},
		[forget],
	);
	const of = useCallback((place: string): FillState => states[place] ?? IDLE, [states]);
	return fill ? { run, again, of, stop, forget, discard } : undefined;
}
export type Fills = NonNullable<ReturnType<typeof useFills>>;

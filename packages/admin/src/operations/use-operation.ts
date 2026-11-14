import type { Message } from "@monti-cms/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAdmin } from "./admin-context";
import { type Answer, type CallOptions, NO_ANSWER } from "./transport";

/** Why an operation did not go through, as the screen shows it. `conflict`: the record changed since it was read, so the screen reloads it. */
export type Refusal = { status: number; error: string; reason: Message | null };

/**
 * What a refusal says to the person: its reason, or with none (a server that failed and said nothing) that something went wrong, and no more.
 * The one place this fallback is made: its words take no values, so no screen can show an unfilled `{…}`.
 */
export const reasonOf = (refusal: Refusal): Message => refusal.reason ?? { key: "errors.unexpected" };

/**
 * Whether a call was lost rather than refused: no answer came at all (status 0, the network), or the server failed and gave no reason. A
 * refusal is the server's own no, with why; a lost call is a failure, and a screen that tells the two apart says this one as an error.
 */
export const isLost = (refusal: Refusal) => refusal.status === NO_ANSWER.status || refusal.reason === null;

/** How a read made again went (`useRead`'s `reload`): `changed` when it brought another answer than the one the screen held. */
type Reread = { ok: true; changed: boolean } | { ok: false; refusal: Refusal };

const refusalOf = (answer: Answer): Refusal => {
	const body = (answer.body ?? {}) as { error?: string; reason?: Message };
	return { status: answer.status, error: body.error ?? "unexpected", reason: body.reason ?? null };
};

/**
 * Calls one operation (build.md rule 3: screens reach the server only this way). `run` sends the input, the versions the screen read and the proposals it took; it
 * resolves to the answer's body, or to a refusal the screen shows.
 */
export function useOperation<Output = unknown>(name: string) {
	const { transport, wrote, session } = useAdmin();
	const end = session.end;
	const [pending, setPending] = useState(false);
	const [refusal, setRefusal] = useState<Refusal | null>(null);
	const run = useCallback(
		async (
			input: unknown = {},
			options?: CallOptions,
		): Promise<{ ok: true; body: Output } | { ok: false; refusal: Refusal }> => {
			setPending(true);
			try {
				// No answer at all (the network, a transport that throws): a refusal like any other, so a screen's read shows its way to try again and a
				// write says it did not go through. Thrown on, a first read left its screen empty for good, with nothing to press.
				const answer = await transport(name, input, options).catch((): Answer => NO_ANSWER);
				if (answer.status === 200) {
					setRefusal(null);
					// A write's answer has its activity row's place (`null` for a write that keeps only the assistant's books); a read's has none.
					if (typeof answer.body === "object" && answer.body !== null && "activityId" in answer.body) wrote();
					return { ok: true, body: answer.body as Output };
				}
				const refused = refusalOf(answer);
				// No session: it ended while the admin was open. Every screen hears it, not only the one that called (doc 15).
				if (answer.status === 401 && refused.error === "unauthenticated") end();
				setRefusal(refused);
				return { ok: false, refusal: refused };
			} finally {
				setPending(false);
			}
		},
		[transport, name, wrote, end],
	);
	return { run, pending, refusal, clear: () => setRefusal(null) };
}

/**
 * Reads with an operation when the screen opens, whenever `reload` is called, and after every write that goes through anywhere in the admin
 * (`wrote`): what a screen shows from the server is never older than the last write this admin made, whichever screen or panel made it (an
 * assistant's proposal applied from its panel, a publish from the list). One rule for every read, so no screen has to know which writes touch
 * it. A read whose screen holds unsaved work over it says `afterWrites: false` and decides itself what a write means for it (the entry
 * editor: `useEntryEditor`). With `skip` it reads nothing (a new record has nothing to read yet).
 *
 * A read that is refused or gets no answer is said at the screen's top, with "try again" (`ReadFailedBanner`): the caller does nothing for
 * that. Two kinds of read say otherwise:
 * - `quiet`: a refusal with a reason is a state the screen knows and shows its own way (the line is gone, the file is in the trash). Only a
 *   lost call (no answer, a server that failed) is said at the top.
 * - `own`: the screen says this read's failures itself, and the shared banner waits while it does (no two banners for one matter):
 *   - `true`: its own banner on every failure, over what it read before too (the activity log's list);
 *   - `"empty"`: its own banner only while it has nothing to show (the compare view); a later failure is said at the top like any other;
 *   - `"answered"`: its own banner while it has nothing, and once it has, the toast that answers the press which read again (an
 *     editor's entry): nothing is said at the top a second time.
 * An ended session is never said here: it has its own banner.
 */
export function useRead<Output>(
	name: string,
	input: unknown = {},
	options: { afterWrites?: boolean; skip?: boolean; quiet?: boolean; own?: true | "empty" | "answered" } = {},
) {
	const { onWrite, reads } = useAdmin();
	const { run } = useOperation<Output>(name);
	const [data, setData] = useState<Output | null>(null);
	const [refusal, setRefusal] = useState<Refusal | null>(null);
	const key = JSON.stringify(input);
	const latest = useRef(0);
	const skip = options.skip ?? false;
	const afterWrites = options.afterWrites ?? true;
	/** The last answer, as text: a read again that brings the same answer keeps the one the screen holds (see `reload`). */
	const held = useRef<string | null>(null);
	/**
	 * Reads again. Resolves to how the read went: a caller that goes on from the new read must not go on from the old one, and says why only when
	 * the reason is its own to say (an ended session has its banner).
	 */
	const reload = useCallback(async (): Promise<Reread> => {
		if (skip) return { ok: true, changed: false };
		const call = ++latest.current;
		const result = await run(JSON.parse(key));
		let changed = false;
		if (call === latest.current) {
			if (result.ok) {
				// Every write anywhere reads again, and most bring back what was there: the answer keeps its identity then, so nothing made from
				// it is made again (the body editor is made from the blocks' catalog: made again, it would be destroyed under the cursor).
				const text = JSON.stringify(result.body) ?? null;
				if (text !== held.current) {
					changed = true;
					held.current = text;
					setData(result.body);
				}
				setRefusal(null);
			} else setRefusal(result.refusal);
		}
		return result.ok ? { ok: true, changed } : result;
	}, [run, key, skip]);
	useEffect(() => {
		void reload();
	}, [reload]);
	useEffect(() => (afterWrites ? onWrite(() => void reload()) : undefined), [afterWrites, onWrite, reload]);
	// What the screen's top says of this read. `me` is this read for its whole life; the newest `reload` is the one made again.
	const me = useRef({}).current;
	const again = useRef(reload);
	again.current = reload;
	const quiet = options.quiet ?? false;
	const holds = data !== null;
	/** The screen's own banner is speaking for this read. */
	const own = options.own === true || (options.own !== undefined && !holds);
	/** The screen has answered this failure already, in its own way. */
	const answered = options.own === "answered" && holds;
	useEffect(() => {
		const said = refusal !== null && !skip && refusal.status !== 401 && (!quiet || isLost(refusal)) && !answered;
		reads.set(me, said ? { refusal, own, reload: () => again.current() } : null);
	}, [reads, me, refusal, skip, quiet, own, answered]);
	useEffect(() => () => reads.set(me, null), [reads, me]);
	return { data, refusal, reload };
}

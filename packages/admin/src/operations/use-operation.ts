import type { Message } from "@monti-cms/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAdmin } from "./admin-context";
import type { Answer, CallOptions } from "./transport";

/** Why an operation did not go through, as the screen shows it. `conflict`: the record changed since it was read, so the screen reloads it. */
export type Refusal = { status: number; error: string; reason: Message | null };

/**
 * What stands for an answer that never came, as the byte route does (`httpUploader`): status 0. It carries its own words, so every screen that shows a
 * refusal's reason says this one whole, with no code of ours in it.
 */
const NO_ANSWER: Answer = { status: 0, body: { error: "network", reason: { key: "errors.noAnswer" } } };

/** How a read made again went (`useRead`'s `reload`). */
type Reread = { ok: true } | { ok: false; refusal: Refusal };

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
 * Reads with an operation when the screen opens, whenever `reload` is called, and with `afterWrites` after every write that goes through (the
 * sidebar's counts, doc 15). With `skip` it reads nothing (a new record has nothing to read yet).
 */
export function useRead<Output>(
	name: string,
	input: unknown = {},
	options: { afterWrites?: boolean; skip?: boolean } = {},
) {
	const { onWrite } = useAdmin();
	const { run } = useOperation<Output>(name);
	const [data, setData] = useState<Output | null>(null);
	const [refusal, setRefusal] = useState<Refusal | null>(null);
	const key = JSON.stringify(input);
	const latest = useRef(0);
	const skip = options.skip ?? false;
	/**
	 * Reads again. Resolves to how the read went: a caller that goes on from the new read must not go on from the old one, and says why only when
	 * the reason is its own to say (an ended session has its banner).
	 */
	const reload = useCallback(async (): Promise<Reread> => {
		if (skip) return { ok: true };
		const call = ++latest.current;
		const result = await run(JSON.parse(key));
		if (call === latest.current) {
			if (result.ok) {
				setData(result.body);
				setRefusal(null);
			} else setRefusal(result.refusal);
		}
		return result.ok ? { ok: true } : result;
	}, [run, key, skip]);
	useEffect(() => {
		void reload();
	}, [reload]);
	useEffect(
		() => (options.afterWrites ? onWrite(() => void reload()) : undefined),
		[options.afterWrites, onWrite, reload],
	);
	return { data, refusal, reload };
}

import type { Message } from "@monti-cms/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAdmin } from "./admin-context";
import type { Answer, CallOptions } from "./transport";

/** Why an operation did not go through, as the screen shows it. `conflict`: the record changed since it was read, so the screen reloads it. */
export type Refusal = { status: number; error: string; reason: Message | null };

const refusalOf = (answer: Answer): Refusal => {
	const body = (answer.body ?? {}) as { error?: string; reason?: Message };
	return { status: answer.status, error: body.error ?? "unexpected", reason: body.reason ?? null };
};

/**
 * Calls one operation (build.md rule 3: screens reach the server only this way). `run` sends the input, the versions the screen read and the proposals it took; it
 * resolves to the answer's body, or to a refusal the screen shows.
 */
export function useOperation<Output = unknown>(name: string) {
	const { transport, wrote } = useAdmin();
	const [pending, setPending] = useState(false);
	const [refusal, setRefusal] = useState<Refusal | null>(null);
	const run = useCallback(
		async (
			input: unknown = {},
			options?: CallOptions,
		): Promise<{ ok: true; body: Output } | { ok: false; refusal: Refusal }> => {
			setPending(true);
			try {
				const answer = await transport(name, input, options);
				if (answer.status === 200) {
					setRefusal(null);
					// A write's answer names its activity row; a read's does not.
					if (typeof (answer.body as { activityId?: unknown } | null)?.activityId === "string") wrote();
					return { ok: true, body: answer.body as Output };
				}
				const refused = refusalOf(answer);
				setRefusal(refused);
				return { ok: false, refusal: refused };
			} finally {
				setPending(false);
			}
		},
		[transport, name, wrote],
	);
	return { run, pending, refusal, clear: () => setRefusal(null) };
}

/**
 * Reads with an operation when the screen opens, whenever `reload` is called, and with `afterWrites` after every write that goes through (the
 * sidebar's counts, doc 15).
 */
export function useRead<Output>(name: string, input: unknown = {}, options: { afterWrites?: boolean } = {}) {
	const { onWrite } = useAdmin();
	const { run } = useOperation<Output>(name);
	const [data, setData] = useState<Output | null>(null);
	const [refusal, setRefusal] = useState<Refusal | null>(null);
	const key = JSON.stringify(input);
	const latest = useRef(0);
	const reload = useCallback(async () => {
		const call = ++latest.current;
		const result = await run(JSON.parse(key));
		if (call !== latest.current) return;
		if (result.ok) {
			setData(result.body);
			setRefusal(null);
		} else setRefusal(result.refusal);
	}, [run, key]);
	useEffect(() => {
		void reload();
	}, [reload]);
	useEffect(
		() => (options.afterWrites ? onWrite(() => void reload()) : undefined),
		[options.afterWrites, onWrite, reload],
	);
	return { data, refusal, reload };
}

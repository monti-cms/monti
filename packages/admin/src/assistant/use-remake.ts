import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAdmin } from "../operations/admin-context";
import { startTask, type Task } from "./run-task";
import { AssistantContext } from "./use-assistant";

/** A map without one item's entry. */
function without<V>(map: ReadonlyMap<string, V>, item: string): ReadonlyMap<string, V> {
	const next = new Map(map);
	next.delete(item);
	return next;
}

/** "Make again" of a change that did not go: its one failure line, and whether "Try again" can go. */
export type RemakeFailure = { why: string; retry: boolean };

/**
 * "Make again" (doc 10): the assistant makes one proposed change again on its record as it is now, a small run of its own read to its end
 * by the shared runner. Every screen that offers it uses this: the review page's row, the editor's card of a change the text moved away
 * from. `ready` is done first (the screen saved; `false` calls it off), `settled` after (the screen reads its proposals again). `undefined`
 * on a site without the assistant.
 */
export function useRemake({
	ready,
	settled,
}: {
	ready?: () => Promise<boolean>;
	settled?: () => Promise<unknown> | unknown;
} = {}) {
	const assistant = useContext(AssistantContext);
	const { streams, transport, t, language } = useAdmin();
	const there = assistant?.available === true;
	const touch = assistant?.touchProposals;
	const [working, setWorking] = useState<ReadonlySet<string>>(new Set());
	const [failed, setFailed] = useState<ReadonlyMap<string, RemakeFailure>>(new Map());
	const going = useRef(new Map<string, Task>());
	const hooks = useRef({ ready, settled });
	hooks.current = { ready, settled };
	useEffect(() => {
		const all = going.current;
		return () => {
			// The screen went: the runs go on in the server, and what they make is there when it opens again.
			for (const task of all.values()) task.leave();
			all.clear();
		};
	}, []);

	const remake = useCallback(
		async (item: string) => {
			if (going.current.has(item)) return;
			if (hooks.current.ready && !(await hooks.current.ready().catch(() => false))) return;
			setFailed((now) => without(now, item));
			setWorking((now) => new Set(now).add(item));
			const task = startTask({ streams, transport, t, language }, { again: item });
			going.current.set(item, task);
			const end = await task.ended;
			if (going.current.get(item) !== task) return;
			going.current.delete(item);
			if (end === null) return;
			touch?.();
			await Promise.resolve(hooks.current.settled?.()).catch(() => {});
			setWorking((now) => new Set([...now].filter((each) => each !== item)));
			if (end.why) setFailed((now) => new Map(now).set(item, { why: end.why ?? "", retry: end.retry }));
		},
		[streams, transport, t, language, touch],
	);

	/** Stops making it again: the change stays as it was. */
	const stop = useCallback((item: string) => going.current.get(item)?.stop(), []);

	return useMemo(() => (there ? { remake, stop, working, failed } : undefined), [there, remake, stop, working, failed]);
}
export type Remake = NonNullable<ReturnType<typeof useRemake>>;

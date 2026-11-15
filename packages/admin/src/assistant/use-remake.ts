import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAdmin } from "../operations/admin-context";
import { nextOf, startTask, type Task } from "./run-task";
import { AssistantContext } from "./use-assistant";

/** A map without one item's entry. */
function without<V>(map: ReadonlyMap<string, V>, item: string): ReadonlyMap<string, V> {
	const next = new Map(map);
	next.delete(item);
	return next;
}

/** "Make again" of a change that did not go: its one failure line, and what its button does ("Try again", or "Go on" where it stopped). */
export type RemakeFailure = { why: string; next: "retry" | "goOn" | null; run: string | null };

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

	/** Runs one "make again" (or its going on) to its end, and shows how it ended. */
	const follow = useCallback(
		async (item: string, input: Record<string, unknown>) => {
			setFailed((now) => without(now, item));
			setWorking((now) => new Set(now).add(item));
			const task = startTask({ streams, transport, t, language }, input);
			going.current.set(item, task);
			const end = await task.ended;
			if (going.current.get(item) !== task) return;
			going.current.delete(item);
			if (end === null) return;
			touch?.();
			await Promise.resolve(hooks.current.settled?.()).catch(() => {});
			setWorking((now) => new Set([...now].filter((each) => each !== item)));
			const why = end.why;
			if (why) setFailed((now) => new Map(now).set(item, { why, next: nextOf(end), run: end.run }));
		},
		[streams, transport, t, language, touch],
	);

	/** "Make again"; or, after one that did not go, its line's button: "Try again" asks again, "Go on" goes on from where it stopped. */
	const remake = useCallback(
		async (item: string) => {
			if (going.current.has(item)) return;
			const was = failed.get(item);
			if (was?.next === "goOn" && was.run) return follow(item, { resume: was.run, more: true });
			if (hooks.current.ready && !(await hooks.current.ready().catch(() => false))) return;
			await follow(item, { again: item });
		},
		[failed, follow],
	);

	/** Stops making it again: the change stays as it was. */
	const stop = useCallback((item: string) => going.current.get(item)?.stop(), []);

	return useMemo(() => (there ? { remake, stop, working, failed } : undefined), [there, remake, stop, working, failed]);
}
export type Remake = NonNullable<ReturnType<typeof useRemake>>;

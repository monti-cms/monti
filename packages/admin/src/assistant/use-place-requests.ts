import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAdmin } from "../operations/admin-context";
import { nextOf, startTask, type Task } from "./run-task";
import { AssistantContext } from "./use-assistant";

/** What was asked at a place and what the assistant said back. */
export type Exchange = { request: string; answer: string };

/**
 * One request left at a place of a screen (doc 10, a request at its place): on words picked in the text, on one proposed change, or
 * "✦ Translate". It is a small run of its own: several run beside each other and beside the panel's conversation.
 */
export type PlaceRequest = {
	/** Its own name on the screen. A request on a proposed change is named by the change: `item:<id>`. */
	id: string;
	/** The proposed change it is asked of; `null` for a request on picked words. */
	item: string | null;
	/** `writing`: its card is open and nothing is sent yet. `working`: the assistant is at it. `answered`: it ended without becoming a change. */
	status: "writing" | "working" | "answered";
	/** What was asked and answered here, oldest first; the last answer grows while the assistant works. */
	thread: Exchange[];
	/** Why the last request did not go, in one short line (the one failure line of AI work). */
	failed: string | null;
	/** What the failure line offers: ask the same again, or let a run that stopped where it can go on (a limit, a lost connection) go on. */
	next: "retry" | "goOn" | null;
};

/** What a request on picked words sends along: the screen it is on and the words (`ScreenContext`). */
export type PlaceContext = Record<string, unknown>;
type About = { item: string } | { context: PlaceContext };
type Of = About | (() => Promise<About | null>);

/** What was sent last at a place: what "Try again" sends again, and the run "Go on" carries past its limit. */
type Last = { words: string; of: Of; ready?: () => Promise<boolean>; run: string | null };

/**
 * The requests left at places of one screen. `undefined` on a site without the assistant: nothing of it is drawn. `settled` is called
 * when a request's run has ended, with whether it proposed something: the screen reads its proposals again.
 */
export function usePlaceRequests(settled: (proposed: boolean) => Promise<unknown> | unknown) {
	const assistant = useContext(AssistantContext);
	const { streams, transport, t, language } = useAdmin();
	const there = assistant?.available === true;
	const touch = assistant?.touchProposals;
	const [requests, setRequests] = useState<PlaceRequest[]>([]);
	const going = useRef(new Map<string, Task>());
	const conversations = useRef(new Map<string, string>());
	const last = useRef(new Map<string, Last>());
	const after = useRef(settled);
	after.current = settled;
	const gone = useRef(false);
	useEffect(() => {
		gone.current = false;
		const all = going.current;
		return () => {
			gone.current = true;
			// The screen went: nobody listens any more. The runs go on in the server, and what they propose is there when the screen opens again.
			for (const each of all.values()) each.leave();
			all.clear();
		};
	}, []);

	const change = useCallback(
		(id: string, next: (request: PlaceRequest) => PlaceRequest | null) =>
			setRequests((all) => all.flatMap((each) => (each.id === id ? (next(each) ?? []) : [each]))),
		[],
	);

	/** Opens a request on picked words: its card is there to be written in. */
	const begin = useCallback((id: string) => {
		setRequests((all) => [
			...all.filter((each) => each.status !== "writing"),
			{ id, item: null, status: "writing", thread: [], failed: null, next: null },
		]);
	}, []);

	const dismiss = useCallback((id: string) => {
		going.current.get(id)?.leave();
		going.current.delete(id);
		last.current.delete(id);
		setRequests((all) => all.filter((each) => each.id !== id));
	}, []);

	/** Runs one task for a place to its end, and shows how it ended there. */
	const follow = useCallback(
		async (id: string, item: string | null, input: Record<string, unknown>) => {
			const task = startTask({ streams, transport, t, language }, input, {
				onRun: (_run, conversation) => conversations.current.set(id, conversation),
				// The answer grows in the card as it comes.
				onText: (answer) =>
					change(id, (request) => ({
						...request,
						thread: request.thread.map((each, at) => (at === request.thread.length - 1 ? { ...each, answer } : each)),
					})),
			});
			going.current.set(id, task);
			const end = await task.ended;
			if (going.current.get(id) === task) going.current.delete(id);
			if (end === null || gone.current) return;
			const kept = last.current.get(id);
			if (kept) kept.run = end.run;
			touch?.();
			// Whatever the screen's own reading meets, the request ends.
			await Promise.resolve(after.current(end.proposed)).catch(() => {});
			// Asked again at this place while the screen read its proposals: the place is the newer request's now.
			if (gone.current || going.current.has(id)) return;
			const failed = end.status === "failed" || end.status === "interrupted";
			change(id, (request) => {
				// Done and it became a change: the change's own mark takes the place (a request on a proposed change ends with the change,
				// whose card shows what was asked from its own thread).
				if (!failed && (item !== null || end.proposed)) return null;
				const thread = request.thread.map((each, at) =>
					at === request.thread.length - 1 ? { ...each, answer: end.answer } : each,
				);
				return {
					...request,
					status: "answered",
					thread,
					failed: end.why,
					next: nextOf(end),
				};
			});
		},
		[streams, transport, t, language, touch, change],
	);

	/**
	 * Sends what was written: on picked words (`context` says which), on a proposed change (`item`), or a set request ("✦ Translate"). The
	 * answer is a change proposed at that place; words alone stay in the card.
	 */
	const send = useCallback(
		async (
			id: string,
			words: string,
			/** What it is about; a request on picked words may make it when it is ready (the entry read again), or give `null` to call it off. */
			of: Of,
			/** What must be done first (the screen saved); `false` calls the request off. */
			ready?: () => Promise<boolean>,
		) => {
			// A request on a proposed change is named by the change.
			const item = typeof of === "function" ? null : "item" in of ? of.item : null;
			last.current.set(id, { words, of, ready, run: null });
			let before: PlaceRequest | undefined;
			setRequests((all) => {
				const was = all.find((each) => each.id === id);
				before = was;
				const next: PlaceRequest = {
					id,
					item,
					status: "working",
					thread: [...(was?.thread ?? []), { request: words, answer: "" }],
					failed: null,
					next: null,
				};
				return was ? all.map((each) => (each.id === id ? next : each)) : [...all, next];
			});
			// What it is about may have to be made ready first (the screen saved, the entry read): the request says "working" from the
			// press, so its card cannot be taken for one nothing was sent from. Not ready after all (the save was refused): as it was.
			const set = ready ? await ready().catch(() => false) : true;
			const about = !set ? null : typeof of === "function" ? await of().catch(() => null) : of;
			if (about === null) {
				if (!gone.current)
					setRequests((all) => all.flatMap((each) => (each.id === id ? (before ? [before] : []) : [each])));
				return;
			}
			const conversation = conversations.current.get(id) ?? null;
			// A request on picked words and "✦ Translate" have no model menu: they use the quick-task model of the keys screen. A request on a
			// proposed change goes on in the conversation that made it, with its model.
			const input =
				"item" in about
					? { request: words, item: about.item }
					: { request: words, context: about.context, quick: true, ...(conversation ? { conversation } : {}) };
			await follow(id, item, input);
		},
		[follow],
	);

	/**
	 * The failure line's button: "Try again" sends the last words again as they were asked (the failed exchange gives way to the new one),
	 * and "Go on" lets the run go on from where it stopped (past a limit, with as much again).
	 */
	const again = useCallback(
		(id: string) => {
			const kept = last.current.get(id);
			const request = requests.find((each) => each.id === id);
			if (!kept || !request || request.status !== "answered" || !request.failed) return;
			if (request.next === "goOn" && kept.run) {
				change(id, (was) => ({ ...was, status: "working", failed: null, next: null }));
				void follow(id, request.item, { resume: kept.run, more: true });
				return;
			}
			change(id, (was) => ({ ...was, thread: was.thread.slice(0, -1) }));
			void send(id, kept.words, kept.of, kept.ready);
		},
		[requests, change, follow, send],
	);

	/** Stops the assistant's work on a request: what it proposed by then stays. */
	const stop = useCallback((id: string) => going.current.get(id)?.stop(), []);

	return useMemo(
		() => (there ? { requests, begin, send, again, stop, dismiss } : undefined),
		[there, requests, begin, send, again, stop, dismiss],
	);
}

import type { Message } from "@monti-cms/core";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAdmin } from "../operations/admin-context";
import { AssistantContext } from "./use-assistant";

/** What was asked at a place and what the assistant said back. */
export type Exchange = { request: string; answer: string };

/**
 * One request left at a place of a screen (doc 10, a request at its place): on words picked in the text, or on one proposed change. It
 * is a small run of its own: several run beside each other and beside the panel's conversation.
 */
export type PlaceRequest = {
	/** Its own name on the screen. A request on a proposed change is named by the change: `item:<id>`. */
	id: string;
	/** The proposed change it is asked of; `null` for a request on picked words. */
	item: string | null;
	/** `writing`: its card is open and nothing is sent yet. `working`: the assistant is at it. `answered`: it said something and proposed nothing. */
	status: "writing" | "working" | "answered";
	/** What was asked and answered here, oldest first; the last one has no answer while the assistant works. */
	thread: Exchange[];
	/** Why the last request did not go through, in the server's words. */
	failed: string | null;
};

type Going = {
	run: string | null;
	stop: AbortController;
	conversation: string | null;
	/** Stop was pressed before the run said its id: it is stopped as soon as it does. */
	stopWanted: boolean;
};

/** What a request on picked words sends along: the screen it is on and the words (`ScreenContext`). */
export type PlaceContext = Record<string, unknown>;
type About = { item: string } | { context: PlaceContext };

/**
 * The requests left at places of one screen. `undefined` on a site without the assistant: nothing of it is drawn. `settled` is called
 * when a request's run has ended, with whether it proposed something: the screen reads its proposals again.
 */
export function usePlaceRequests(settled: (proposed: boolean) => Promise<unknown> | unknown) {
	const assistant = useContext(AssistantContext);
	const { streams, transport, t } = useAdmin();
	const there = assistant?.available === true;
	const touch = assistant?.touchProposals;
	const [requests, setRequests] = useState<PlaceRequest[]>([]);
	const going = useRef(new Map<string, Going>());
	const conversations = useRef(new Map<string, string>());
	const after = useRef(settled);
	after.current = settled;
	const gone = useRef(false);
	useEffect(() => {
		gone.current = false;
		const all = going.current;
		return () => {
			gone.current = true;
			// The screen went: nobody listens any more. The runs go on in the server, and what they propose is there when the screen opens again.
			for (const each of all.values()) each.stop.abort();
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
			{ id, item: null, status: "writing", thread: [], failed: null },
		]);
	}, []);

	const dismiss = useCallback((id: string) => {
		going.current.get(id)?.stop.abort();
		going.current.delete(id);
		setRequests((all) => all.filter((each) => each.id !== id));
	}, []);

	/**
	 * Sends what was written: on picked words (`context` says which), or on a proposed change (`item`). The answer is a change proposed
	 * at that place; words alone stay in the card.
	 */
	const send = useCallback(
		async (
			id: string,
			words: string,
			/** What it is about; a request on picked words may make it when it is ready (the entry read again), or give `null` to call it off. */
			of: About | (() => Promise<About | null>),
			/** What must be done first (the screen saved); `false` calls the request off. */
			ready?: () => Promise<boolean>,
		) => {
			// A request on a proposed change is named by the change.
			const item = typeof of === "function" ? null : "item" in of ? of.item : null;
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
			const stop = new AbortController();
			const conversation = conversations.current.get(id) ?? null;
			const mine: Going = { run: null, stop, conversation, stopWanted: false };
			going.current.set(id, mine);
			const input =
				"item" in about
					? { request: words, item: about.item }
					: { request: words, context: about.context, ...(conversation ? { conversation } : {}) };
			let answer = "";
			let proposed = false;
			let failed: string | null = null;
			const reply = await streams("assistant.run", input, { signal: stop.signal }).catch(() => null);
			if (reply && "events" in reply) {
				try {
					for await (const raw of reply.events) {
						const event = raw as {
							type: string;
							delta?: string;
							runId?: string;
							conversationId?: string;
							error?: { detail: string; keyName: string | null };
							status?: string;
						};
						if (event.type === "run") {
							mine.run = event.runId ?? null;
							if (event.conversationId) conversations.current.set(id, event.conversationId);
							if (mine.stopWanted && mine.run) void transport("assistant.stop", { run: mine.run }).catch(() => {});
						} else if (event.type === "text") answer += event.delta ?? "";
						else if (event.type === "proposal") proposed = true;
						else if (event.type === "end" && event.status === "failed")
							failed = [event.error?.keyName, event.error?.detail].filter(Boolean).join(" · ") || t("errors.noAnswer");
					}
				} catch {
					// The connection went: what the run proposed by then is read below.
				}
			} else if (!stop.signal.aborted) {
				const reason = (reply as { body?: { reason?: Message } } | null)?.body?.reason;
				failed = t(reason ?? "errors.noAnswer");
			}
			if (going.current.get(id) === mine) going.current.delete(id);
			if (gone.current) return;
			touch?.();
			// Whatever the screen's own reading meets, the request ends.
			await Promise.resolve(after.current(proposed)).catch(() => {});
			// Asked again at this place while the screen read its proposals: the place is the newer request's now.
			if (gone.current || going.current.has(id)) return;
			change(id, (request) => {
				// A request on a proposed change ends with the change: its card shows what was asked from the change's own thread.
				if (item !== null && failed === null) return null;
				// A request on picked words that became a proposed change gives its place to the change's own mark.
				if (item === null && proposed && failed === null) return null;
				const thread = request.thread.map((each, at) =>
					at === request.thread.length - 1 ? { ...each, answer: answer.trim() } : each,
				);
				return { ...request, status: "answered", thread, failed };
			});
		},
		[streams, transport, t, touch, change],
	);

	/** Stops the assistant's work on a request: what it proposed by then stays. */
	const stop = useCallback(
		(id: string) => {
			const mine = going.current.get(id);
			if (!mine) return;
			// The run goes on in the server whether or not the page listens: it is told to stop, now or as soon as it says which run it is.
			if (mine.run) void transport("assistant.stop", { run: mine.run }).catch(() => {});
			else mine.stopWanted = true;
		},
		[transport],
	);

	return useMemo(
		() => (there ? { requests, begin, send, stop, dismiss } : undefined),
		[there, requests, begin, send, stop, dismiss],
	);
}

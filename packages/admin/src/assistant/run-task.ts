import type { RunEnd, RunEvent, RunState } from "@monti-cms/ai";
import type { Message, ModelChoice } from "@monti-cms/core";
import type { StreamTransport, Transport } from "../operations/transport";
import { canRetry, failureIn, failureText, reasonText } from "./failure";

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** How often a run that is going without this page listening (another tab, a request that was cut) is read again. */
export const POLL_MS = 3000;
/** How many times in a row the browser goes on by itself with a run whose request was cut, before it says so and leaves it to the person. */
export const CUTS_BEFORE_ASKING = 2;
/** Refusals of a resume that mean the server knows more of the run than this page: it is at work elsewhere, over, or not the newest. */
export const AHEAD: ReadonlySet<string> = new Set(["assistant.busy", "assistant.ended", "assistant.notNewest"]);

/**
 * Where a run's request ended is a place the browser goes on from by itself (doc 10, limits): one request's time is up (`goOn`), or the run
 * waits on the screen (`screen`). `null` for every other end, and for any end once the person said stop. The panel and the runner both ask this.
 */
export function onwardAfter(end: RunEnd, stopAsked: boolean): "goOn" | "screen" | null {
	if (stopAsked) return null;
	if (end.status === "waiting") return "screen";
	if (end.status === "interrupted" && end.reason === "time") return "goOn";
	return null;
}

/** After the `cuts`-th cut in a row (this one counted), the browser goes on by itself; at `CUTS_BEFORE_ASKING` it stops and asks. */
export const goesOnAfterCut = (cuts: number): boolean => cuts > 0 && cuts < CUTS_BEFORE_ASKING;

/** How one AI task ended, as the place it was asked at shows it. */
export type TaskEnd = {
	/**
	 * `done`: it finished. `stopped`: a person stopped it. `failed`: it did not go (`why` says why in one line). `interrupted`: it stopped
	 * where it can go on, at its turns or tokens or a connection lost again and again (`why` says which); "Go on" resumes it.
	 */
	status: "done" | "stopped" | "failed" | "interrupted";
	/** What the assistant said, as it stands at the end. */
	answer: string;
	/** It proposed something: the screen reads its proposals again. */
	proposed: boolean;
	/** Why it did not go, in the one short line every AI failure has. `null` when it went. */
	why: string | null;
	/** Asking again can go (`canRetry`). */
	retry: boolean;
	/** The run, when the server opened one: what "go on" resumes. */
	run: string | null;
	conversation: string | null;
};

/** What the failure line of an ended task offers: "Go on" where the run can go on, "Try again" where asking again can go, else nothing. */
export const nextOf = (end: TaskEnd): "retry" | "goOn" | null =>
	end.status === "interrupted" ? "goOn" : end.status === "failed" && end.retry ? "retry" : null;

/** One AI task under way: what it ends with, and the ways to stop it or stop listening. */
export type Task = {
	ended: Promise<TaskEnd | null>;
	/** Tells the run to stop (now, or as soon as it says which run it is). What it proposed by then stays. */
	stop: () => void;
	/** Stops listening without stopping the run (the screen went): `ended` gives `null`. */
	leave: () => void;
};

/** `language`: the admin's, which the assistant answers in. */
type Deps = { streams: StreamTransport; transport: Transport; t: Translate; language: string };

/**
 * Runs one small AI task to its end (doc 10, the shared runner): a request at a place, "✦ Translate", making a change again. What no person
 * needs to press happens here: one request's time is up, or the host cut the request, and the task goes on from where it was; a cut that keeps
 * coming at the same place ends as a lost connection. The end is said in the admin's words (`failureText`), never the service's.
 * `onText` gets the answer as it grows; `onRun` the run, its conversation and the model it runs on, once the server has opened it.
 */
export function startTask(
	{ streams, transport, t, language }: Deps,
	input: Record<string, unknown>,
	on: {
		onText?: (answer: string) => void;
		onRun?: (run: string, conversation: string, model: ModelChoice) => void;
	} = {},
): Task {
	const listening = new AbortController();
	// Going on with a run: it is that run from the start, so a refusal of it is read as the run (another page may have it).
	let run: string | null = typeof input.resume === "string" ? input.resume : null;
	let conversation: string | null = null;
	let stopAsked = false;
	const tellStop = () => {
		if (run) void transport("assistant.stop", { run }).catch(() => {});
	};

	const ended = (async (): Promise<TaskEnd | null> => {
		let answer = "";
		// Where the turn being written began: an answer cut in the middle comes again from there when the run goes on.
		let turnAt = 0;
		let proposed = false;
		let cuts = 0;
		// A new request says which language to answer in; going on with a run asks nothing new.
		let request: Record<string, unknown> = "resume" in input ? input : { ...input, language };
		const finish = (status: TaskEnd["status"], why: string | null = null, retry = true): TaskEnd => ({
			status,
			answer: answer.trim(),
			proposed,
			why,
			retry,
			run,
			conversation,
		});
		/** How an end that the browser does not go on from reads at this place. */
		const over = (end: RunEnd): TaskEnd => {
			if (end.status === "done") return finish("done");
			if (end.status === "stopped" || stopAsked) return finish("stopped");
			if (end.status === "failed")
				return end.error
					? finish("failed", failureText(t, end.error), canRetry(end.error))
					: finish("failed", t("errors.noAnswer"));
			if (end.reason === "turns" || end.reason === "tokens") return finish("interrupted", t("panel.limit"));
			return finish("interrupted", t("panel.dropped"));
		};
		/**
		 * Reads the run (whatever kind it is) until no request holds it any more, and gives how it stands: its end, what the assistant said
		 * and whether it proposed, as stored. `null`: it could not be read.
		 */
		const standing = async (): Promise<{ end: RunEnd; answer: string; proposed: boolean } | null> => {
			if (!run) return null;
			for (;;) {
				const read = await transport("assistant.runState", { run }).catch(() => null);
				if (listening.signal.aborted) return null;
				if (read?.status !== 200) return null;
				const state = read.body as RunState;
				conversation ??= state.conversationId;
				if (state.status !== "running")
					return { end: state.end ?? { status: state.status }, answer: state.answer, proposed: state.proposed };
				await new Promise<void>((resolve) => {
					const timer = setTimeout(resolve, POLL_MS);
					listening.signal.addEventListener("abort", () => {
						clearTimeout(timer);
						resolve();
					});
				});
				if (listening.signal.aborted) return null;
			}
		};
		/** The run is over as it was stored: its stored words and what it proposed stand, whatever this page heard of them. */
		const stored = (stands: { answer: string; proposed: boolean }) => {
			if (stands.answer.trim() !== "") answer = stands.answer;
			proposed ||= stands.proposed;
		};

		for (;;) {
			const reply = await streams("assistant.run", request, { signal: listening.signal }).catch(() => null);
			if (listening.signal.aborted) return null;
			let end: RunEnd | null = null;
			if (reply && "events" in reply) {
				try {
					for await (const raw of reply.events) {
						const event = raw as RunEvent;
						if (event.type === "run") {
							run = event.runId;
							conversation = event.conversationId;
							on.onRun?.(run, conversation, event.model);
							if (stopAsked) tellStop();
						} else if (event.type === "text") {
							answer += event.delta;
							on.onText?.(answer.trim());
						} else if (event.type === "tool") {
							turnAt = answer.length;
							// A tool got through: the run moves, and the cuts before it no longer count as one place.
							if (event.state !== "running") cuts = 0;
						} else if (event.type === "proposal") proposed = true;
						else if (event.type === "end") end = event;
					}
				} catch {
					// The connection went: how the run stands is read below.
				}
				if (listening.signal.aborted) return null;
			} else {
				const reason = (reply?.body as { reason?: Message } | undefined)?.reason;
				const refused = (why: Message) => finish("failed", reasonText(t, why), canRetry(failureIn(why)));
				// Not a run at all yet: the server refused the request, or no answer came.
				if (!run) return reason ? refused(reason) : finish("failed", t("panel.dropped"));
				// Going on was refused for a reason that is not the server being ahead: that reason is the end.
				if (reason && !AHEAD.has(reason.key)) return refused(reason);
				// The server is ahead (another page has the run, or it ended): it is read as it stands, and nothing goes on from here.
				if (reason) {
					const stands = await standing();
					if (listening.signal.aborted) return null;
					if (!stands) return finish("interrupted", t("panel.dropped"));
					stored(stands);
					return over(stands.end);
				}
			}
			if (!end) {
				// Cut before the run said how it ended: the words of the turn that was cut come again, and the run is read where it stands.
				if (!run) return finish("failed", t("panel.dropped"));
				cuts += 1;
				const stands = await standing();
				if (listening.signal.aborted) return null;
				const cutThere = stands === null || (stands.end.status === "interrupted" && stands.end.reason === "connection");
				// The words of the turn that was cut were not stored: when the run goes on, that turn comes again from its start.
				answer = answer.slice(0, turnAt);
				if (!cutThere) {
					stored(stands);
					end = stands.end;
				} else if (goesOnAfterCut(cuts) && !stopAsked) {
					request = { resume: run };
					continue;
				} else return stopAsked ? finish("stopped") : finish("interrupted", t("panel.dropped"));
			}
			if (!end) return finish("interrupted", t("panel.dropped"));
			const onward = onwardAfter(end, stopAsked);
			if (onward === null) return over(end);
			// A small run has no screen to move: what it waited on is answered as not done, and it goes on.
			request = { resume: run, ...(onward === "screen" ? { away: true } : {}) };
		}
	})();

	return {
		ended,
		stop: () => {
			stopAsked = true;
			tellStop();
		},
		leave: () => listening.abort(),
	};
}

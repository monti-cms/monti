import type {
	AssistantState,
	Conversation,
	ConversationRow,
	RunEnd,
	RunEvent,
	ScreenContext,
	Thinking,
	TranscriptRun,
} from "@monti-cms/ai";
import type { Message, ModelList } from "@monti-cms/core";
import { toast } from "@monti-cms/ui";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useUnsavedChanges } from "../draft/leave-guard";
import { useAdmin } from "../operations/admin-context";
import type { Route } from "../route";
import { type ContextChip, chipsOf, contextWithout, type ToolPart } from "./words";

/** One thing a turn showed, in the order it came. `stale` words are of an answer that was cut: they stay until the answer comes again. */
export type Part = { type: "text"; text: string; stale?: boolean } | ToolPart | { type: "said"; text: string };

/** One request and what answered it, as the panel draws it. */
export type Turn = {
	/** The run's id; a name of its own until the run has said its id. */
	id: string;
	request: string;
	/** What went along with the request, as its bubble says. */
	chips: string[];
	parts: Part[];
	proposalId: string | null;
	status: TranscriptRun["status"];
	end: RunEnd | null;
	at: string;
	/** It never reached the server: there is no run to go on with, only the same words to send again. */
	unsent?: boolean;
};

type Place = NonNullable<Conversation["earlier"]>;
type ScreenCall = { id: string; name: string; input: unknown };
type ModelChoice = { keyId: string; model: string };
type Kept = { open: boolean; conversation: string | null; recent: ModelChoice[] };

const KEPT = "monti.assistant";
/** How often a run that is going somewhere else (another tab, a request that was cut) is read again. */
const POLL_MS = 3000;
/** How many times in a row the browser goes on by itself with a run whose request was cut, before it says so. */
const CUTS_BEFORE_ASKING = 2;

function kept(): Kept {
	try {
		const stored = JSON.parse(localStorage.getItem(KEPT) ?? "null") as Partial<Kept> | null;
		return { open: stored?.open === true, conversation: stored?.conversation ?? null, recent: stored?.recent ?? [] };
	} catch {
		return { open: false, conversation: null, recent: [] };
	}
}
const keep = (change: Partial<Kept>) => {
	try {
		localStorage.setItem(KEPT, JSON.stringify({ ...kept(), ...change }));
	} catch {
		// A browser that keeps nothing: the panel still works, and opens closed next time.
	}
};

const turnOf = (run: TranscriptRun, chips: (context: ScreenContext | null) => string[]): Turn => ({
	id: run.id,
	request: run.request,
	chips: chips((run.context as ScreenContext | null) ?? null),
	parts: run.parts.map((part) =>
		part.type === "tool" ? { ...part, state: part.failed ? ("failed" as const) : ("done" as const) } : part,
	),
	proposalId: run.proposalId,
	status: run.status,
	end: run.end,
	at: new Date(run.startedAt).toISOString(),
});

type AssistantValue = {
	/** Whether the site has the assistant at all; `null` until that is known. Without it no ✦ is drawn anywhere. */
	available: boolean | null;
	state: AssistantState | null;
	open: boolean;
	setOpen: (open: boolean) => void;
	view: "chat" | "history";
	setView: (view: "chat" | "history") => void;
	conversationId: string | null;
	turns: Turn[];
	/** How many of the oldest requests the next request leaves out of what the model is sent, out of how many it has. */
	forgotten: number;
	requests: number;
	/** Which screen is open, as it registered itself (`list`, `entry`, `media`). */
	screenKind: string | null;
	hasEarlier: boolean;
	loadEarlier: () => Promise<void>;
	busy: boolean;
	draft: string;
	setDraft: (draft: string) => void;
	queue: string[];
	queueAdd: (words: string) => void;
	queueTake: (index: number) => void;
	queueCancel: (index: number) => void;
	queueSendNow: (index: number) => void;
	ask: (request: string) => void;
	stop: () => void;
	/** Goes on with the last run where it stopped; `more` past a turn or token limit. */
	goOn: (more?: boolean) => void;
	/** Sends the last request again, as a new one. */
	again: () => void;
	models: ModelList | null;
	model: ModelChoice | null;
	thinking: Thinking;
	recent: ModelChoice[];
	pickModel: (choice: ModelChoice) => void;
	setThinking: (level: Thinking) => void;
	history: { rows: ConversationRow[]; more: boolean } | null;
	loadHistory: (more?: boolean) => Promise<void>;
	removeConversation: (id: string) => Promise<void>;
	setKeepDays: (days: number | null) => Promise<void>;
	openConversation: (id: string) => Promise<void>;
	fresh: () => void;
	chips: ContextChip[];
	removeChip: (id: ContextChip["id"]) => void;
	setScreen: (context: ScreenContext | null) => void;
	/** Counts the proposals' changes as the run reports them, so a card reads its proposal again. */
	proposalTick: number;
	touchProposals: () => void;
	/** Opens a proposal's review page. */
	openReview: (id: string) => void;
};

const Context = createContext<AssistantValue | null>(null);

export function useAssistant(): AssistantValue {
	const value = useContext(Context);
	if (!value) throw new Error("The assistant's parts need an <AssistantProvider>.");
	return value;
}

/** A screen says what it has open and what is picked in it (doc 10, context): it goes along with the next request, as chips over the input. */
export function useScreenContext(context: ScreenContext | null) {
	const setScreen = useContext(Context)?.setScreen;
	const key = JSON.stringify(context);
	useEffect(() => {
		setScreen?.(JSON.parse(key) as ScreenContext | null);
		return () => setScreen?.(null);
	}, [setScreen, key]);
}

/**
 * The assistant as the admin holds it (doc 10): whether the site has one, the open conversation, the run that is going and what the person
 * queued behind it, the model, and the past conversations. It listens to the run's stream and goes on by itself where no person is needed: a
 * request that reached its time limit, a screen tool the browser ran, a request the host cut.
 */
export function AssistantProvider({
	go,
	leave,
	children,
}: {
	/** Moves the screen at once: the assistant's own moves, made only when nothing is unsaved. */
	go: (route: Route) => void;
	/** Moves the screen as a person's press does: it asks first when something is unsaved. */
	leave: (go: () => void) => void;
	children: ReactNode;
}) {
	const { transport, streams, screen, t, wrote } = useAdmin();
	const unsaved = useUnsavedChanges();
	const [available, setAvailable] = useState<boolean | null>(null);
	const [state, setState] = useState<AssistantState | null>(null);
	const [open, setOpenState] = useState(() => kept().open);
	const [view, setView] = useState<"chat" | "history">("chat");
	const [conversationId, setConversationId] = useState<string | null>(() => kept().conversation);
	const [turns, setTurns] = useState<Turn[]>([]);
	const [earlier, setEarlier] = useState<Place | null>(null);
	const [forgotten, setForgotten] = useState(0);
	const [requests, setRequests] = useState(0);
	const [busy, setBusy] = useState(false);
	const [draft, setDraft] = useState("");
	const [queue, setQueueState] = useState<string[]>([]);
	// What waits, as it is this instant: a run can end and the next one begin before the page is drawn again, and each must see the queue
	// the one before left.
	const queueNow = useRef<string[]>([]);
	const setQueue = useCallback((next: string[] | ((waiting: string[]) => string[])) => {
		queueNow.current = typeof next === "function" ? next(queueNow.current) : next;
		setQueueState(queueNow.current);
	}, []);
	const [models, setModels] = useState<ModelList | null>(null);
	const [picked, setPicked] = useState<ModelChoice | null>(null);
	const [level, setLevel] = useState<Thinking | null>(null);
	const [recent, setRecent] = useState<ModelChoice[]>(() => kept().recent);
	const [history, setHistory] = useState<{ rows: ConversationRow[]; earlier: Place | null } | null>(null);
	const [screenContext, setScreen] = useState<ScreenContext | null>(null);
	const [removed, setRemoved] = useState<ReadonlySet<ContextChip["id"]>>(new Set());
	const [proposalTick, setProposalTick] = useState(0);

	// What the stream's loop reads as it is now, not as it was when the request began.
	const live = useRef({ conversationId, turns, queue, busy });
	live.current = { conversationId, turns, queue, busy };
	const listening = useRef<AbortController | null>(null);
	const cuts = useRef(0);
	// What listening to a request leads on to (the next queued words, a run to watch, a screen tool): each is made further down and calls back
	// into listening, so they are reached through here as they are now.
	const later = useRef<{
		ask: (request: string) => void;
		watch: (runId: string) => Promise<void>;
		runScreenTool: (tool: ScreenCall) => Promise<{ id: string; output?: unknown; error?: string }>;
	}>({ ask: () => {}, watch: async () => {}, runScreenTool: async (tool) => ({ id: tool.id }) });

	const call = useCallback(
		async <Output,>(
			name: string,
			input: unknown = {},
		): Promise<{ ok: true; body: Output } | { ok: false; reason: Message | null; status: number }> => {
			const answer = await transport(name, input);
			if (answer.status === 200) return { ok: true, body: answer.body as Output };
			const body = (answer.body ?? {}) as { reason?: Message };
			return { ok: false, reason: body.reason ?? null, status: answer.status };
		},
		[transport],
	);
	const chipLabels = useCallback((context: ScreenContext | null) => chipsOf(context, t).map((chip) => chip.label), [t]);

	const readState = useCallback(async () => {
		const read = await call<AssistantState>("assistant.state");
		// A site without the assistant has no such operation: nothing of the assistant is drawn.
		setAvailable(read.ok || read.status !== 404);
		if (read.ok) setState(read.body);
		const listed = await call<ModelList>("models.list");
		if (listed.ok) setModels(listed.body);
	}, [call]);
	useEffect(() => {
		void readState();
	}, [readState]);

	const setOpen = useCallback(
		(next: boolean) => {
			setOpenState(next);
			keep({ open: next });
			// Opened again: a key may have been added meanwhile.
			if (next) void readState();
		},
		[readState],
	);

	const patchTurn = useCallback((id: string, change: (turn: Turn) => Turn) => {
		setTurns((all) => all.map((turn) => (turn.id === id ? change(turn) : turn)));
	}, []);

	const readConversation = useCallback(
		async (id: string): Promise<Conversation | null> => {
			const read = await call<Conversation>("conversations.get", { id });
			if (!read.ok) return null;
			setTurns((now) => {
				const stored = read.body.runs.map((run) => turnOf(run, chipLabels));
				// Words of an answer that was cut are not stored: they stay on screen until the answer comes again.
				const last = now.at(-1);
				const cut = last?.parts.at(-1);
				const same = stored.at(-1);
				if (last && same && same.id === last.id && cut?.type === "text" && cut.stale && same.status !== "done")
					return [...stored.slice(0, -1), { ...same, parts: [...same.parts, cut] }];
				return stored;
			});
			setEarlier(read.body.earlier);
			setForgotten(read.body.forgotten);
			setRequests(read.body.requests);
			if (read.body.model) setPicked(read.body.model);
			if (read.body.thinking) setLevel(read.body.thinking as Thinking);
			return read.body;
		},
		[call, chipLabels],
	);

	// The conversation's model, while a key of the site still has it; a conversation whose key was removed goes on with the site's starting model.
	const listed = (choice: ModelChoice | null) =>
		choice !== null &&
		(models?.keys.some((key) => key.id === choice.keyId && key.models.some((each) => each.id === choice.model)) ??
			true);
	const model = (listed(picked) ? picked : null) ?? models?.assistant ?? null;
	const canThink =
		models?.keys.find((key) => key.id === model?.keyId)?.models.find((each) => each.id === model?.model)?.thinking ??
		false;
	const thinking: Thinking = canThink ? (level ?? "medium") : "off";
	const sending = useRef({ model, thinking, screenContext, removed });
	sending.current = { model, thinking, screenContext, removed };

	/** Listens to one request of a run to its end, and does what follows without a person: the next request of the same run, or the next queued words. */
	const listen = useCallback(
		async (input: Record<string, unknown>, turnId: string) => {
			listening.current?.abort();
			const controller = new AbortController();
			listening.current = controller;
			setBusy(true);
			let id = turnId;
			let ended: (RunEnd & { untaken: string[] }) | null = null;
			let screenCalls: ScreenCall[] = [];
			let cut = false;
			const answer = await streams("assistant.run", input, { signal: controller.signal });
			if (!("events" in answer)) {
				if (controller.signal.aborted) return;
				setBusy(false);
				const reason = ((answer.body ?? {}) as { reason?: Message }).reason;
				// It never began. With a reason the server said why (another request is still going); without one it was not reached.
				if (reason) toast.error(t(reason));
				patchTurn(id, (turn) =>
					turn.status === "running" && turn.parts.length === 0
						? { ...turn, status: "failed", unsent: true, end: { status: "failed" } }
						: turn,
				);
				return;
			}
			try {
				for await (const event of answer.events as AsyncIterable<RunEvent | { type: "error" }>) {
					if (event.type === "run") {
						const from = id;
						id = event.runId;
						setConversationId(event.conversationId);
						// At once, for a request that follows before the page is drawn again: it is asked in this conversation.
						live.current.conversationId = event.conversationId;
						keep({ conversation: event.conversationId });
						setTurns((all) => all.map((turn) => (turn.id === from ? { ...turn, id: event.runId } : turn)));
					} else if (event.type === "text") {
						patchTurn(id, (turn) => {
							const last = turn.parts.at(-1);
							// The answer that was cut comes again from its start: its old words give way.
							if (last?.type === "text" && last.stale)
								return { ...turn, parts: [...turn.parts.slice(0, -1), { type: "text", text: event.delta }] };
							if (last?.type === "text")
								return {
									...turn,
									parts: [...turn.parts.slice(0, -1), { type: "text", text: last.text + event.delta }],
								};
							return { ...turn, parts: [...turn.parts, { type: "text", text: event.delta }] };
						});
					} else if (event.type === "tool") {
						if (event.state !== "running") cuts.current = 0;
						patchTurn(id, (turn) => {
							const parts = turn.parts.filter((part) => !(part.type === "text" && part.stale));
							const at = parts.findIndex((part) => part.type === "tool" && part.id === event.id);
							const before = at === -1 ? undefined : (parts[at] as ToolPart);
							const next: ToolPart = {
								type: "tool",
								id: event.id,
								name: event.name,
								kind: event.kind,
								input: event.input ?? before?.input,
								state: event.state,
								count: event.count ?? before?.count,
								progress: event.state === "running" ? before?.progress : undefined,
							};
							return {
								...turn,
								parts: at === -1 ? [...parts, next] : parts.map((part, index) => (index === at ? next : part)),
							};
						});
					} else if (event.type === "progress") {
						patchTurn(id, (turn) => {
							const at = turn.parts.findLastIndex(
								(part) => part.type === "tool" && part.name === event.name && part.state === "running",
							);
							if (at === -1) return turn;
							return {
								...turn,
								parts: turn.parts.map((part, index) =>
									index === at ? { ...(part as ToolPart), progress: { done: event.done, total: event.total } } : part,
								),
							};
						});
					} else if (event.type === "proposal") {
						patchTurn(id, (turn) => ({ ...turn, proposalId: event.proposalId }));
						setProposalTick((tick) => tick + 1);
					} else if (event.type === "taken") {
						patchTurn(id, (turn) => ({ ...turn, parts: [...turn.parts, { type: "said", text: event.text }] }));
					} else if (event.type === "screen") screenCalls = event.calls;
					else if (event.type === "end") ended = event;
					else if (event.type === "error") cut = true;
				}
			} catch {
				cut = true;
			}
			if (controller.signal.aborted) return;
			if (!ended) cut = true;

			if (cut || !ended) {
				// The request ended without the run's own ending (the host cut it, the network went): the run may still be going on the server.
				cuts.current += 1;
				patchTurn(id, (turn) => {
					const last = turn.parts.at(-1);
					return last?.type === "text"
						? { ...turn, parts: [...turn.parts.slice(0, -1), { ...last, stale: true }] }
						: turn;
				});
				void later.current.watch(id);
				return;
			}
			const end = ended as RunEnd & { untaken: string[] };
			if (end.untaken.length > 0) setQueue((waiting) => [...end.untaken, ...waiting]);
			patchTurn(id, (turn) => ({
				...turn,
				status: end.status,
				end: { status: end.status, reason: end.reason, error: end.error },
				// A person stopped it: what was still going has no result, and its line goes.
				parts:
					end.status === "stopped"
						? turn.parts.filter((part) => !(part.type === "tool" && part.state === "running"))
						: turn.parts,
			}));
			if (end.status === "waiting") {
				// Screen tools run here, in the browser, and the run goes on with what they answered.
				const answers = await Promise.all(screenCalls.map((each) => later.current.runScreenTool(each)));
				if (controller.signal.aborted) return;
				patchTurn(id, (turn) => ({ ...turn, status: "running", end: null }));
				return listen({ resume: id, screen: answers }, id);
			}
			if (end.status === "interrupted" && end.reason === "time") {
				// One request's time is up, not the run's: the next request goes on where this one stopped. Nobody presses anything.
				patchTurn(id, (turn) => ({ ...turn, status: "running", end: null }));
				return listen({ resume: id }, id);
			}
			setBusy(false);
			cuts.current = 0;
			void readState();
			if (end.status === "done") {
				const [next, ...rest] = queueNow.current;
				if (next !== undefined) {
					setQueue(rest);
					later.current.ask(next);
				}
			}
		},
		[streams, patchTurn, readState, t, setQueue],
	);

	/** Runs one screen tool in the browser and says what happened, as the model reads it. */
	const runScreenTool = useCallback(
		async (tool: ScreenCall): Promise<{ id: string; output?: unknown; error?: string }> => {
			if (tool.name === "screen.openEntry") {
				// A screen with unsaved changes does not move, and nothing is asked: the assistant is told, and tells the person.
				if (unsaved() > 0) return { id: tool.id, error: "The screen has unsaved changes, so it did not move." };
				const entryId = (tool.input as { id?: string } | null)?.id ?? "";
				const read = await call<{ entry: { collection: string; title: string } }>("entries.get", { id: entryId });
				if (!read.ok) return { id: tool.id, error: "There is no such entry." };
				go({ screen: "entry", collection: read.body.entry.collection, id: entryId });
				return { id: tool.id, output: { opened: read.body.entry.title } };
			}
			return screen.run(tool.name, tool.input)
				? { id: tool.id, output: { done: true } }
				: { id: tool.id, error: "The screen that is open cannot do that." };
		},
		[screen, unsaved, call, go],
	);

	/** Reads a run that is going without this page listening, until it is no longer going; then goes on with it, or says it stopped. */
	const watch = useCallback(
		async (runId: string) => {
			const conversation = live.current.conversationId;
			if (!conversation) return setBusy(false);
			for (;;) {
				const read = await readConversation(conversation);
				if (live.current.conversationId !== conversation) return;
				const run = read?.runs.find((each) => each.id === runId);
				if (!run) return setBusy(false);
				if (run.status === "running") {
					setBusy(true);
					await new Promise((resolve) => setTimeout(resolve, POLL_MS));
					continue;
				}
				// It stopped where its request was cut. The browser goes on with it by itself, unless that keeps happening at the same place.
				if (run.status === "interrupted" && cuts.current > 0 && cuts.current < CUTS_BEFORE_ASKING) {
					patchTurn(runId, (turn) => ({ ...turn, status: "running", end: null }));
					return listen({ resume: runId }, runId);
				}
				cuts.current = 0;
				return setBusy(false);
			}
		},
		[readConversation, patchTurn, listen],
	);

	const ask = useCallback(
		(request: string) => {
			const words = request.trim();
			if (words === "") return;
			const { model: chosen, thinking: think, screenContext: on, removed: off } = sending.current;
			const context = contextWithout(on, off);
			const id = `local:${Date.now()}:${Math.random().toString(36).slice(2)}`;
			setView("chat");
			setTurns((all) => [
				...all,
				{
					id,
					request: words,
					chips: chipLabels(context),
					parts: [],
					proposalId: null,
					status: "running",
					end: null,
					at: new Date().toISOString(),
				},
			]);
			cuts.current = 0;
			void listen(
				{
					...(live.current.conversationId ? { conversation: live.current.conversationId } : {}),
					request: words,
					...(context ? { context } : {}),
					...(chosen ? { model: chosen } : {}),
					thinking: think,
				},
				id,
			);
		},
		[listen, chipLabels],
	);

	later.current = { ask, watch, runScreenTool };

	const stop = useCallback(() => {
		const last = live.current.turns.at(-1);
		if (!last) return;
		// It shows as stopped at once: what was still going has no result, and its line goes.
		patchTurn(last.id, (turn) => ({
			...turn,
			status: "stopped",
			end: { status: "stopped" },
			parts: turn.parts.filter((part) => !(part.type === "tool" && part.state === "running")),
		}));
		// A run that has not said its id yet has nothing to stop on the server but its request.
		if (last.id.startsWith("local:")) {
			listening.current?.abort();
			return setBusy(false);
		}
		// The run is told to stop and ends by itself: its request stays listened to, so the run ends as stopped and not as cut off, and a new
		// request is taken once it has. What was said to it and not taken comes back with its end, or here when it was only waiting.
		void call<{ output: { untaken: string[] } }>("assistant.stop", { run: last.id }).then((stopped) => {
			const untaken = stopped.ok ? stopped.body.output.untaken : [];
			if (untaken.length > 0) setQueue((waiting) => [...untaken, ...waiting]);
		});
	}, [call, patchTurn, setQueue]);

	const goOn = useCallback(
		(more = false) => {
			const last = live.current.turns.at(-1);
			if (!last || last.id.startsWith("local:")) return;
			cuts.current = 0;
			patchTurn(last.id, (turn) => ({ ...turn, status: "running", end: null }));
			void listen({ resume: last.id, ...(more ? { more: true } : {}) }, last.id);
		},
		[listen, patchTurn],
	);

	const again = useCallback(() => {
		const last = live.current.turns.at(-1);
		if (!last) return;
		// Words that never reached the server are sent as the same turn, not as a second one under it.
		if (last.unsent) setTurns((all) => all.slice(0, -1));
		ask(last.request);
	}, [ask]);

	const openConversation = useCallback(
		async (id: string) => {
			listening.current?.abort();
			setBusy(false);
			setQueue([]);
			setConversationId(id);
			live.current.conversationId = id;
			keep({ conversation: id });
			setView("chat");
			const read = await readConversation(id);
			if (!read) {
				// It was deleted meanwhile (here or in another tab): a new one.
				setConversationId(null);
				keep({ conversation: null });
				setTurns([]);
				return;
			}
			// A run that is going elsewhere shows as going, and is read again until it is not.
			const last = read.runs.at(-1);
			if (last && (last.status === "running" || last.status === "waiting")) void watch(last.id);
		},
		[readConversation, watch, setQueue],
	);
	// The conversation that was open comes back with the page.
	const restored = useRef(false);
	useEffect(() => {
		if (restored.current || available !== true) return;
		restored.current = true;
		const id = kept().conversation;
		if (id) void openConversation(id);
	}, [available, openConversation]);

	const fresh = useCallback(() => {
		// A run that is going goes on; it is in the past conversations.
		listening.current = null;
		setBusy(false);
		setQueue([]);
		setTurns([]);
		setEarlier(null);
		setForgotten(0);
		setRequests(0);
		setConversationId(null);
		live.current.conversationId = null;
		setPicked(null);
		setLevel(null);
		keep({ conversation: null });
		setView("chat");
	}, [setQueue]);

	const loadEarlier = useCallback(async () => {
		const id = live.current.conversationId;
		if (!id || !earlier) return;
		const read = await call<Conversation>("conversations.get", { id, before: earlier });
		if (!read.ok) return;
		setTurns((now) => [...read.body.runs.map((run) => turnOf(run, chipLabels)), ...now]);
		setEarlier(read.body.earlier);
	}, [call, earlier, chipLabels]);

	const loadHistory = useCallback(
		async (more = false) => {
			const before = more ? history?.earlier : undefined;
			const read = await call<{ conversations: ConversationRow[]; earlier: Place | null; keepDays: number | null }>(
				"conversations.list",
				before ? { before } : {},
			);
			if (!read.ok) return;
			setHistory((was) => ({
				rows: more && was ? [...was.rows, ...read.body.conversations] : read.body.conversations,
				earlier: read.body.earlier,
			}));
			setState((was) => (was ? { ...was, keepDays: read.body.keepDays } : was));
		},
		[call, history?.earlier],
	);

	const removeConversation = useCallback(
		async (id: string) => {
			const done = await call("conversations.remove", { id });
			if (!done.ok) return void toast.error(t(done.reason ?? "errors.unexpected"));
			setHistory((was) => (was ? { ...was, rows: was.rows.filter((row) => row.id !== id) } : was));
			if (live.current.conversationId === id) fresh();
		},
		[call, fresh, t],
	);

	const setKeepDays = useCallback(
		async (days: number | null) => {
			const done = await call("conversations.keep", { days });
			if (!done.ok) return void toast.error(t(done.reason ?? "errors.unexpected"));
			setState((was) => (was ? { ...was, keepDays: days } : was));
			wrote();
		},
		[call, t, wrote],
	);

	const pickModel = useCallback((choice: ModelChoice) => {
		setPicked(choice);
		setRecent((was) => {
			const next = [choice, ...was.filter((each) => each.keyId !== choice.keyId || each.model !== choice.model)].slice(
				0,
				3,
			);
			keep({ recent: next });
			return next;
		});
	}, []);

	// A chip taken off comes back when what it stood for changes: another entry is opened, other rows are picked.
	const screenKey = screenContext
		? `${screenContext.screen}:${screenContext.entry?.id ?? screenContext.collection ?? ""}`
		: "";
	const selectionKey = JSON.stringify(screenContext?.selection ?? null);
	// biome-ignore lint/correctness/useExhaustiveDependencies: the keys are what it follows
	useEffect(() => {
		setRemoved((was) => (was.has("screen") ? new Set([...was].filter((id) => id !== "screen")) : was));
	}, [screenKey]);
	// biome-ignore lint/correctness/useExhaustiveDependencies: the keys are what it follows
	useEffect(() => {
		setRemoved((was) => (was.has("selection") ? new Set([...was].filter((id) => id !== "selection")) : was));
	}, [selectionKey]);
	const chips = useMemo(
		() => chipsOf(screenContext, t).filter((chip) => !removed.has(chip.id)),
		[screenContext, removed, t],
	);

	const value: AssistantValue = {
		available,
		state,
		open,
		setOpen,
		view,
		setView,
		conversationId,
		turns,
		forgotten,
		// A request just asked is one more than the last read counted.
		requests: Math.max(requests, turns.length),
		screenKind: screenContext?.screen ?? null,
		hasEarlier: earlier !== null,
		loadEarlier,
		busy,
		draft,
		setDraft,
		queue,
		queueAdd: (words) => setQueue((waiting) => [...waiting, words]),
		queueTake: (index) => {
			setDraft(queue[index] ?? "");
			setQueue((waiting) => waiting.filter((_, at) => at !== index));
		},
		queueCancel: (index) => setQueue((waiting) => waiting.filter((_, at) => at !== index)),
		queueSendNow: (index) => {
			const words = queue[index];
			const last = turns.at(-1);
			if (words === undefined || !last) return;
			setQueue((waiting) => waiting.filter((_, at) => at !== index));
			// The run takes it in before its next turn and says so (`taken`); if it ends first, its end hands the words back.
			void call("assistant.say", { run: last.id, text: words }).then((said) => {
				if (!said.ok) setQueue((waiting) => [words, ...waiting]);
			});
		},
		ask,
		stop,
		goOn,
		again,
		models,
		model,
		thinking,
		recent,
		pickModel,
		setThinking: setLevel,
		history: history ? { rows: history.rows, more: history.earlier !== null } : null,
		loadHistory,
		removeConversation,
		setKeepDays,
		openConversation,
		fresh,
		chips,
		removeChip: (id) => setRemoved((was) => new Set([...was, id])),
		setScreen,
		proposalTick,
		touchProposals: () => setProposalTick((tick) => tick + 1),
		openReview: (id) => leave(() => go({ screen: "review", id })),
	};
	return <Context.Provider value={value}>{children}</Context.Provider>;
}

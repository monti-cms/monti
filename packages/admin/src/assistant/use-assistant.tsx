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
import { useSaveUnsaved, useUnsavedChanges } from "../draft/leave-guard";
import { useAdmin } from "../operations/admin-context";
import { MODELS_ASK_AGAIN_MS } from "../operations/models";
import { NO_ANSWER } from "../operations/transport";
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
	/** Why it never began, in the server's own words (another request is still going, the model is gone, no answer came). */
	refusal?: Message | null;
};

/** Words that wait to be asked, with a name of their own: what is done to one finds it whatever was added or taken meanwhile. */
export type Queued = { id: string; text: string };

/** Why a screen tool did not move the screen: the open screen has unsaved changes, the entry is not there, or the screen cannot do it. */
export type MoveRefusal = "unsaved" | "noEntry" | "cannot";

type UnsavedOf = () => Record<string, unknown> | undefined;
type Place = NonNullable<Conversation["earlier"]>;
type ScreenCall = { id: string; name: string; input: unknown };
type ModelChoice = { keyId: string; model: string };

/**
 * The conversation that is open, as one object. Another is made whenever another conversation is opened (or none: "+"), so "is this still the
 * conversation on the page" is one comparison, and everything that waits on the server (a run's stream, a read, a poll) keeps the one it began
 * under and looks again when it comes back. What belongs to a conversation that is no longer open changes nothing on the page; its run is
 * not cut, and goes on.
 */
type Shown = {
	conversationId: string | null;
	/** What follows this conversation's run now: one request's stream, or the poll of a run that goes on elsewhere. One at a time. */
	following: AbortController | null;
	/** The person said stop: nothing goes on with the run by itself until they ask again. */
	stopAsked: boolean;
	/** How many times in a row the run's request was cut. */
	cuts: number;
	/** Where the requests before the ones read begin, and whether they are being read now. */
	earlier: Place | null;
	loadingEarlier: boolean;
	/** The turn a stream is writing now: a read of the conversation does not put its stored, shorter form over it. */
	writing: string | null;
	/** The requests made here since this conversation was opened: a read that was asked for before one of them does not take it away. */
	asked: Set<string>;
	/** What the screen answered for a run, when the request that carried it did not get through: it goes with the next one. */
	unsent: { run: string; screen: unknown[] } | null;
};
const showing = (conversationId: string | null): Shown => ({
	conversationId,
	following: null,
	stopAsked: false,
	cuts: 0,
	earlier: null,
	loadingEarlier: false,
	writing: null,
	asked: new Set(),
	unsent: null,
});
const local = (id: string) => id.startsWith("local:");
/** Whether a key of the site still has this model. A list not read yet says nothing against it. */
const has = (list: ModelList | null, choice: ModelChoice | null) =>
	choice !== null &&
	(list?.keys.some((key) => key.id === choice.keyId && key.models.some((each) => each.id === choice.model)) ?? true);
const named = (text: string): Queued => ({ id: `q:${Date.now()}:${Math.random().toString(36).slice(2)}`, text });
type Kept = { open: boolean; conversation: string | null; recent: ModelChoice[] };

const KEPT = "monti.assistant";
/** How often a run that is going somewhere else (another tab, a request that was cut) is read again. */
const POLL_MS = 3000;
/** How many times in a row the browser goes on by itself with a run whose request was cut, before it says so. */
const CUTS_BEFORE_ASKING = 2;

/** Why a run could not be gone on with when the server knows more of it than this page does: it is at work elsewhere, over, or not the newest. */
const AHEAD: ReadonlySet<string> = new Set(["assistant.busy", "assistant.ended", "assistant.notNewest"]);

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
	/** The conversation that was opened is being read: its requests are not here yet. */
	loading: boolean;
	/** Which screen is open, as it registered itself (`list`, `entry`, `media`). */
	screenKind: string | null;
	hasEarlier: boolean;
	loadEarlier: () => Promise<void>;
	busy: boolean;
	draft: string;
	setDraft: (draft: string) => void;
	queue: Queued[];
	queueAdd: (words: string) => void;
	/** Each acts on the waiting words with this id, wherever they stand by now. */
	queueTake: (id: string) => void;
	queueCancel: (id: string) => void;
	queueSendNow: (id: string) => void;
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
	/** Asks the keys' services for their model lists again (the model menu was opened): not more than once in a while. */
	refreshModels: () => void;
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
	/** The open screen's way to say its unsaved values when a request is made; `null` takes away the one named (the screen went). */
	setScreenUnsaved: (read: UnsavedOf | null, of?: UnsavedOf) => void;
	/** The assistant asked the screen to move and it did not, for its unsaved changes, which can be saved from here. */
	blockedMove: boolean;
	/** Saves the open screen and then does what the assistant had asked of it (flow 2·05). `true` only when the screen moved. */
	saveAndOpen: () => Promise<boolean>;
	/** Why the screen did not move after its save went through, to say under the answer. */
	moveRefused: MoveRefusal | null;
	/** Counts the proposals' changes as the run reports them, so a card reads its proposal again. */
	proposalTick: number;
	touchProposals: () => void;
	/** Opens a proposal's review page. */
	openReview: (id: string) => void;
	/**
	 * A screen's "✦ request" on what is picked in it: the panel opens on its conversation with that chip over the box (back, if it was
	 * taken off) and the caret in the box. Nothing is sent. `requested` counts the presses, for the panel to take the caret.
	 */
	request: () => void;
	requested: number;
};

const Context = createContext<AssistantValue | null>(null);
/** The assistant as the admin holds it, for the hooks of this folder that read it where it may be missing. */
export const AssistantContext = Context;

export function useAssistant(): AssistantValue {
	const value = useContext(Context);
	if (!value) throw new Error("The assistant's parts need an <AssistantProvider>.");
	return value;
}

/**
 * Opens the assistant's panel on a conversation, from a screen that shows what the conversation proposed (the proposal bubble's name).
 * Nothing on a page without the assistant.
 */
export function useOpenConversation(): ((id: string) => void) | undefined {
	const assistant = useContext(Context);
	const there = assistant?.available === true;
	const setOpen = there ? assistant.setOpen : undefined;
	const openConversation = there ? assistant.openConversation : undefined;
	return useMemo(
		() =>
			setOpen && openConversation
				? (id: string) => {
						setOpen(true);
						void openConversation(id);
					}
				: undefined,
		[setOpen, openConversation],
	);
}

/**
 * A screen's "✦ request" (the list's bulk bar): opens the panel with what is picked as its chip, ready to be typed in. Nothing on a page
 * without the assistant. A site with no key gets the panel's "add an API key", as from the ✦ in the corner.
 */
export function useRequest(): (() => void) | undefined {
	const assistant = useContext(Context);
	return assistant?.available === true ? assistant.request : undefined;
}

/** Whether the site has the assistant: a screen's row or button about it is not drawn on a site without one. */
export function useHasAssistant(): boolean {
	return useContext(Context)?.available === true;
}

/** What a quick task answers a field with: its value, or in the field's own line why there is none. */
export type Filled = { ok: true; value: string } | { ok: true; values: string[] } | { ok: false; why: string };

/**
 * "✦ Fill" (doc 10, quick tasks): one call of the quick-task model for one field's value. Nothing is stored: the screen puts the
 * answer in the field. Nothing on a site without the assistant, or with no model for the quick tasks (no key): the button is not drawn.
 */
export function useQuickFill(): ((input: Record<string, unknown>) => Promise<Filled>) | undefined {
	const assistant = useContext(Context);
	const { transport, t } = useAdmin();
	const there = assistant?.available === true && Boolean(assistant.models?.quick);
	return useMemo(
		() =>
			there
				? async (input: Record<string, unknown>): Promise<Filled> => {
						const answer = await transport("assistant.fill", input).catch(() => NO_ANSWER);
						if (answer.status === 200)
							return { ok: true, ...(answer.body as { value: string } | { values: string[] }) };
						const reason = ((answer.body ?? {}) as { reason?: Message }).reason;
						const name = String(reason?.values?.name ?? "");
						// The field's line names the key, and not what the service said: one reason, in a few words.
						const why =
							reason?.key === "assistant.refused"
								? t("fill.refused", { name })
								: reason?.key === "assistant.unreachable"
									? t("fill.unreachable", { name })
									: reason?.key === "assistant.noImages"
										? t("fill.noImages")
										: t(reason ?? "errors.noAnswer");
						return { ok: false, why };
					}
				: undefined,
		[there, transport, t],
	);
}

/**
 * Asks the assistant to make one proposed change again on its record as it is now (a small run of its own, read to its end), from a screen
 * that shows the change where it applies: the editor's "make again" on a proposal the text moved away from. A refusal is said. Nothing on
 * a page without the assistant.
 */
export function useRemakeItem(): ((item: string) => Promise<void>) | undefined {
	const assistant = useContext(Context);
	const { streams, t } = useAdmin();
	const there = assistant?.available === true;
	const touch = assistant?.touchProposals;
	return useMemo(
		() =>
			there
				? async (item: string) => {
						const answer = await streams("assistant.run", { again: item });
						if ("events" in answer) {
							try {
								for await (const _event of answer.events) {
									// Nothing of it is shown but its result: the change as it was made again.
								}
							} catch {
								// The connection went: the change is read again as it stands.
							}
						} else toast.error(t(((answer.body ?? {}) as { reason?: Message }).reason ?? "errors.unexpected"));
						touch?.();
					}
				: undefined,
		[there, streams, t, touch],
	);
}

/**
 * A screen says what it has open and what is picked in it (doc 10, context): it goes along with the next request, as chips over the input.
 * `unsaved` gives the screen's unsaved values (`draftContext`). It is asked when a request is made, not kept: a body being typed does not
 * draw the page again for the assistant's sake. The values go with the screen's chip, and not without it.
 */
export function useScreenContext(context: ScreenContext | null, unsaved?: () => Record<string, unknown> | undefined) {
	const assistant = useContext(Context);
	const setScreen = assistant?.setScreen;
	const setUnsaved = assistant?.setScreenUnsaved;
	const key = JSON.stringify(context);
	useEffect(() => {
		setScreen?.(JSON.parse(key) as ScreenContext | null);
		return () => setScreen?.(null);
	}, [setScreen, key]);
	const latest = useRef(unsaved);
	latest.current = unsaved;
	useEffect(() => {
		const read = () => latest.current?.();
		setUnsaved?.(read);
		return () => setUnsaved?.(null, read);
	}, [setUnsaved]);
}

/**
 * The assistant as the admin holds it (doc 10): whether the site has one, the open conversation, the run that is going and what the person
 * queued behind it, the model, and the past conversations. It listens to the run's stream and goes on by itself where no person is needed: a
 * request that reached its time limit, a screen tool the browser ran, a request the host cut.
 */
export function AssistantProvider({
	go,
	leave,
	at,
	children,
}: {
	/** Moves the screen at once: the assistant's own moves, made only when nothing is unsaved. */
	go: (route: Route) => void;
	/** Moves the screen as a person's press does: it asks first when something is unsaved. */
	leave: (go: () => void) => void;
	/** The address of the screen that is open: what the assistant asked of one screen is not done on another. */
	at: string;
	children: ReactNode;
}) {
	const { transport, streams, screen, t, wrote } = useAdmin();
	const unsaved = useUnsavedChanges();
	const saving = useSaveUnsaved();
	// What the assistant last asked the screen to do and the screen did not, for its unsaved changes: the step "save and open" takes. It
	// is of the screen it was asked on, and of the request it was asked in: a new request, another conversation or another screen ends it.
	type Step = { call: ScreenCall; at: string };
	const [blocked, setBlockedState] = useState<Step | null>(null);
	const step = useRef<Step | null>(null);
	/** Why the step's move did not happen after its save went through, in the panel's words. */
	const [moveRefused, setMoveRefused] = useState<MoveRefusal | null>(null);
	const setBlocked = useCallback((next: Step | null) => {
		step.current = next;
		setBlockedState(next);
		setMoveRefused(null);
	}, []);
	const here_ = useRef(at);
	here_.current = at;
	// While the step's own save is under way the screen may move by that save (a new template goes to its own page): that is not leaving.
	const savingStep = useRef(false);
	useEffect(() => {
		if (step.current && step.current.at !== at && !savingStep.current) setBlocked(null);
	}, [at, setBlocked]);
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
	const [loading, setLoading] = useState(() => kept().conversation !== null);
	// Words sent to a run with "send now" that the run ended without taking, in a conversation that was not open then: they wait here, and
	// stand over the box again when that conversation is opened.
	const leftWords = useRef(new Map<string, string[]>());
	const [draft, setDraft] = useState("");
	const [queue, setQueueState] = useState<Queued[]>([]);
	// What waits, as it is this instant: a run can end and the next one begin before the page is drawn again, and each must see the queue
	// the one before left.
	const queueNow = useRef<Queued[]>([]);
	const setQueue = useCallback((next: Queued[] | ((waiting: Queued[]) => Queued[])) => {
		queueNow.current = typeof next === "function" ? next(queueNow.current) : next;
		setQueueState(queueNow.current);
	}, []);
	const [models, setModels] = useState<ModelList | null>(null);
	const [picked, setPicked] = useState<ModelChoice | null>(null);
	const [level, setLevel] = useState<Thinking | null>(null);
	const [recent, setRecent] = useState<ModelChoice[]>(() => kept().recent);
	const [history, setHistory] = useState<{ rows: ConversationRow[]; earlier: Place | null } | null>(null);
	const [screenContext, setScreen] = useState<ScreenContext | null>(null);
	const unsavedOf = useRef<UnsavedOf | null>(null);
	const setScreenUnsaved = useCallback((read: UnsavedOf | null, of?: UnsavedOf) => {
		// A screen that goes takes away its own only: the one that took its place may have said its own first.
		if (read !== null || unsavedOf.current === of) unsavedOf.current = read;
	}, []);
	const [removed, setRemoved] = useState<ReadonlySet<ContextChip["id"]>>(new Set());
	const [requested, setRequested] = useState(0);
	const [proposalTick, setProposalTick] = useState(0);
	const touchProposals = useCallback(() => setProposalTick((tick) => tick + 1), []);

	// What the page shows as it is now, not as it was when a request began.
	const live = useRef({ turns, busy });
	live.current = { turns, busy };
	// The conversation that is open (`Shown`). The page's `conversationId` follows it.
	const shown = useRef<Shown>(showing(conversationId));
	// Every request and poll that is going, of the open conversation and of the ones left behind: all end when the admin goes (sign-out).
	const going = useRef(new Set<AbortController>());
	const gone = useRef(false);
	useEffect(() => {
		gone.current = false;
		const all = going.current;
		return () => {
			gone.current = true;
			for (const each of all) each.abort();
			all.clear();
			queueNow.current = [];
		};
	}, []);
	/** Takes over following a conversation's run: a stream that broke, or a poll, gives way to the one that takes over. */
	const follow = useCallback((here: Shown) => {
		const controller = new AbortController();
		here.following?.abort();
		here.following = controller;
		going.current.add(controller);
		// Whether this is still what follows the run of the conversation on the page: asked after every wait, before anything is shown.
		const mine = () => !gone.current && shown.current === here && here.following === controller;
		const done = () => {
			going.current.delete(controller);
		};
		return { controller, mine, done };
	}, []);
	// What listening to a request leads on to (the next queued words, a run to watch, a screen tool): each is made further down and calls back
	// into listening, so they are reached through here as they are now.
	const later = useRef<{
		ask: (request: string) => void;
		watch: (runId: string, here: Shown, mayGoOn?: boolean) => Promise<void>;
		fresh: () => void;
		runScreenTool: (
			tool: ScreenCall,
			called: () => boolean,
		) => Promise<{ id: string; output?: unknown; error?: string }>;
	}>({ ask: () => {}, watch: async () => {}, fresh: () => {}, runScreenTool: async (tool) => ({ id: tool.id }) });

	const call = useCallback(
		async <Output,>(
			name: string,
			input: unknown = {},
		): Promise<{ ok: true; body: Output } | { ok: false; reason: Message | null; status: number }> => {
			// A transport answers a lost network as a refusal; one that throws all the same is answered for here.
			const answer = await transport(name, input).catch(() => NO_ANSWER);
			if (answer.status === 200) return { ok: true, body: answer.body as Output };
			const body = (answer.body ?? {}) as { reason?: Message };
			return { ok: false, reason: body.reason ?? null, status: answer.status };
		},
		[transport],
	);
	const chipLabels = useCallback((context: ScreenContext | null) => chipsOf(context, t).map((chip) => chip.label), [t]);

	const readState = useCallback(async (): Promise<ModelList | null> => {
		const read = await call<AssistantState>("assistant.state");
		// A site without the assistant has no such operation: nothing of the assistant is drawn.
		setAvailable(read.ok || read.status !== 404);
		if (read.ok) setState(read.body);
		const listed = await call<ModelList>("models.list");
		if (listed.ok) setModels(listed.body);
		return listed.ok ? listed.body : null;
	}, [call]);
	useEffect(() => {
		void readState();
	}, [readState]);

	// A service's models change without the key changing (OpenRouter's free ones, weekly), and the server asks only once a day by itself:
	// opening the model menu asks now, as Open WebUI and LibreChat ask when the list is called for. The menu shows what is stored at once,
	// and what comes takes its place.
	const modelsAsked = useRef(0);
	const refreshModels = useCallback(() => {
		const now = Date.now();
		if (now - modelsAsked.current < MODELS_ASK_AGAIN_MS) return;
		modelsAsked.current = now;
		void call<ModelList>("models.list", { refresh: true }).then((listed) => {
			if (listed.ok && !gone.current) setModels(listed.body);
			// No answer: the next opening asks again.
			else if (!listed.ok) modelsAsked.current = 0;
		});
	}, [call]);

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

	/**
	 * Reads a conversation and shows it, if it is still the one that is open (`here`) when the answer comes. `"gone"`: the server has no such
	 * conversation any more; `null`: no answer, or a refusal.
	 */
	const readConversation = useCallback(
		async (id: string, here: Shown): Promise<Conversation | "gone" | null> => {
			const read = await call<Conversation>("conversations.get", { id });
			if (!read.ok) return read.status === 404 || read.reason?.key === "assistant.noConversation" ? "gone" : null;
			// Another conversation was opened meanwhile: this answer is not about what is on the page.
			if (gone.current || shown.current !== here || here.conversationId !== id) return read.body;
			setTurns((now) => {
				const stored = read.body.runs.map((run) => turnOf(run, chipLabels));
				// Words of an answer that was cut are not stored: they stay on screen until the answer comes again.
				const last = now.at(-1);
				const cut = last?.parts.at(-1);
				const same = stored.at(-1);
				const read_ =
					last && same && same.id === last.id && cut?.type === "text" && cut.stale && same.status !== "done"
						? [...stored.slice(0, -1), { ...same, parts: [...same.parts, cut] }]
						: stored;
				// What happened since the read was asked for stays: a request made meanwhile is not in it, and the turn a stream is writing is
				// further on here than in what was stored.
				const known = new Set(read_.map((turn) => turn.id));
				return [
					...read_.map((turn) => (turn.id === here.writing ? (now.find((each) => each.id === turn.id) ?? turn) : turn)),
					...now.filter((turn) => !known.has(turn.id) && here.asked.has(turn.id)),
				];
			});
			here.earlier = read.body.earlier;
			setEarlier(read.body.earlier);
			setForgotten(read.body.forgotten);
			setRequests(read.body.requests);
			if (read.body.model) setPicked(read.body.model);
			if (read.body.thinking) setLevel(read.body.thinking as Thinking);
			return read.body;
		},
		[call, chipLabels],
	);

	// The conversation's model, while a key of the site still has it. When it has gone (its key was removed, the service dropped the model) the
	// site's starting model takes its place, and the person is told once, where they are looking: in the open panel.
	const model = (has(models, picked) ? picked : null) ?? models?.assistant ?? null;
	const pickedGone = open && picked !== null && !has(models, picked);
	const startingModel = models?.assistant?.model ?? null;
	useEffect(() => {
		if (!pickedGone) return;
		setPicked(null);
		if (startingModel) toast(t("panel.modelGone", { model: startingModel }));
	}, [pickedGone, startingModel, t]);
	const canThink =
		models?.keys.find((key) => key.id === model?.keyId)?.models.find((each) => each.id === model?.model)?.thinking ??
		false;
	const thinking: Thinking = canThink ? (level ?? "medium") : "off";
	const sending = useRef({ model, thinking, screenContext, removed });
	sending.current = { model, thinking, screenContext, removed };

	/** The run of the open conversation is over, as far as this page goes: the box takes requests again, and what waited behind a finished run is asked. */
	const settle = useCallback(
		(here: Shown, status: TranscriptRun["status"] | null) => {
			setBusy(false);
			here.cuts = 0;
			void readState();
			if (status !== "done") return;
			const [next, ...rest] = queueNow.current;
			if (next === undefined) return;
			setQueue(rest);
			later.current.ask(next.text);
		},
		[readState, setQueue],
	);

	/** Tells a run to stop. What was said to it and not taken comes back in the answer when the run was only waiting. */
	const tellStop = useCallback(
		(runId: string, here: Shown) => {
			void call<{ output: { untaken: string[] } }>("assistant.stop", { run: runId }).then((stopped) => {
				const untaken = stopped.ok ? stopped.body.output.untaken : [];
				if (untaken.length === 0 || gone.current) return;
				if (shown.current === here) setQueue((waiting) => [...untaken.map(named), ...waiting]);
				else if (here.conversationId)
					leftWords.current.set(here.conversationId, [
						...(leftWords.current.get(here.conversationId) ?? []),
						...untaken,
					]);
			});
		},
		[call, setQueue],
	);

	/**
	 * Listens to one request of a run to its end, and does what follows without a person: the next request of the same run, or the next queued
	 * words. `here` is the conversation it was asked in. While that is the one on the page, what comes is shown; once another was opened, the
	 * stream is still read to its end (the run goes on, doc 10 item 38) and nothing of it is shown, queued or moved on the screen.
	 * `byPerson`: a person pressed for this request, so a refusal is said; a request the browser made by itself is refused silently.
	 */
	const listen = useCallback(
		async (input: Record<string, unknown>, turnId: string, here: Shown, byPerson = true) => {
			if (gone.current) return;
			const { controller, mine, done } = follow(here);
			const show = (write: () => void) => {
				if (mine()) write();
			};
			show(() => setBusy(true));
			let id = turnId;
			here.writing = id;
			const written = () => {
				if (here.writing === id) here.writing = null;
				done();
			};
			let ended: (RunEnd & { untaken: string[] }) | null = null;
			let screenCalls: ScreenCall[] = [];
			let cut = false;
			const answer = await streams("assistant.run", input, { signal: controller.signal });
			if (!("events" in answer)) {
				written();
				if (controller.signal.aborted || !mine()) return;
				const reason = ((answer.body ?? {}) as { reason?: Message }).reason ?? null;
				if ("resume" in input) {
					// The run could not be taken up: no answer came, it ended meanwhile (stopped from here or elsewhere), or another page has
					// it. What the screen had answered is kept for the next request, what the server has is read again, and nothing goes on
					// by itself from this refusal.
					if (Array.isArray(input.screen)) here.unsent = { run: id, screen: input.screen };
					// Another page has the run by now (an old tab pressed "go on" for a run the browser went on with elsewhere), it ended
					// meanwhile, or a newer request stands after it: the server is ahead of this page. Nothing is said: the run is read as
					// it stands and shown so (at work with its stop button, or with its end). Any other reason is the person's to hear.
					if (reason && byPerson && !AHEAD.has(reason.key)) toast.error(t(reason));
					return later.current.watch(id, here, false);
				}
				setBusy(false);
				// It never began: the turn says why in the server's own words (another request is still going, the model is gone), or that
				// no answer came, with the way to send the same words again.
				patchTurn(id, (turn) =>
					turn.status === "running" && turn.parts.length === 0
						? // No answer at all is a connection that was lost, in the panel's own words; a reason is the server's.
							{
								...turn,
								status: "failed",
								unsent: true,
								refusal: answer.status === 0 ? null : reason,
								end: { status: "failed" },
							}
						: turn,
				);
				// The model went while the panel was open: the models are read again, and the panel says which one is used now.
				if (reason?.key === "assistant.noModel") void readState();
				return;
			}
			try {
				for await (const event of answer.events as AsyncIterable<RunEvent | { type: "error" }>) {
					if (event.type === "run") {
						const from = id;
						if (here.writing === from) here.writing = event.runId;
						here.asked.add(event.runId);
						id = event.runId;
						// At once, for a request that follows before the page is drawn again: it is asked in this conversation.
						here.conversationId = event.conversationId;
						show(() => {
							setConversationId(event.conversationId);
							keep({ conversation: event.conversationId });
							setTurns((all) => all.map((turn) => (turn.id === from ? { ...turn, id: event.runId } : turn)));
						});
						// Stop was pressed before the run had a name to stop it by, or just as it was taken up again: it is told now.
						if (here.stopAsked) tellStop(event.runId, here);
					} else if (event.type === "text") {
						show(() =>
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
							}),
						);
					} else if (event.type === "tool") {
						if (event.state !== "running") here.cuts = 0;
						show(() =>
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
							}),
						);
					} else if (event.type === "progress") {
						show(() =>
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
							}),
						);
					} else if (event.type === "proposal") {
						show(() => patchTurn(id, (turn) => ({ ...turn, proposalId: event.proposalId })));
						// A card of this proposal may stand on the page whichever conversation is open (the review page): it reads again.
						if (!gone.current) setProposalTick((tick) => tick + 1);
					} else if (event.type === "taken") {
						show(() =>
							patchTurn(id, (turn) => ({ ...turn, parts: [...turn.parts, { type: "said", text: event.text }] })),
						);
					} else if (event.type === "screen") screenCalls = event.calls;
					else if (event.type === "end") ended = event;
					else if (event.type === "error") cut = true;
				}
			} catch {
				cut = true;
			}
			written();
			if (controller.signal.aborted) return;
			if (!ended) cut = true;

			if (cut || !ended) {
				// The request ended without the run's own ending (the host cut it, the network went): the run may still be going on the server.
				// A conversation left behind is read where it stands when it is opened again.
				if (!mine()) return;
				here.cuts += 1;
				patchTurn(id, (turn) => {
					const last = turn.parts.at(-1);
					return last?.type === "text"
						? { ...turn, parts: [...turn.parts.slice(0, -1), { ...last, stale: true }] }
						: turn;
				});
				return later.current.watch(id, here);
			}
			const end = ended as RunEnd & { untaken: string[] };
			// Where the request ended is a place the browser goes on from by itself, and the person had said stop: it does not go on.
			const onward = end.status === "waiting" || (end.status === "interrupted" && end.reason === "time");
			const halted = onward && here.stopAsked;
			// Words sent with "send now" that the run did not take were said first: they stand first among what waits. In a conversation
			// that is not open they are kept for when it is.
			if (end.untaken.length > 0 && !mine() && !gone.current && here.conversationId)
				leftWords.current.set(here.conversationId, [
					...(leftWords.current.get(here.conversationId) ?? []),
					...end.untaken,
				]);
			show(() => {
				if (end.untaken.length > 0) setQueue((waiting) => [...end.untaken.map(named), ...waiting]);
				patchTurn(id, (turn) => ({
					...turn,
					status: halted ? "stopped" : end.status,
					end: halted ? { status: "stopped" } : { status: end.status, reason: end.reason, error: end.error },
					// A person stopped it: what was still going has no result, and its line goes.
					parts:
						halted || end.status === "stopped"
							? turn.parts.filter((part) => !(part.type === "tool" && part.state === "running"))
							: turn.parts,
				}));
			});
			if (!halted && end.status === "waiting") {
				// Screen tools run here, in the browser, on the screen of the conversation that is open: a run left behind waits until its
				// conversation is opened again.
				if (!mine()) return;
				const answers = await Promise.all(
					screenCalls.map((each) => later.current.runScreenTool(each, () => mine() && !here.stopAsked)),
				);
				if (controller.signal.aborted || !mine()) return;
				// Stopped while the screen did it: the server has ended the run, and there is nothing to go on with.
				if (here.stopAsked) {
					patchTurn(id, (turn) => ({ ...turn, status: "stopped", end: { status: "stopped" } }));
					return settle(here, "stopped");
				}
				patchTurn(id, (turn) => ({ ...turn, status: "running", end: null }));
				return listen({ resume: id, screen: answers }, id, here, false);
			}
			if (!halted && end.status === "interrupted" && end.reason === "time") {
				// One request's time is up, not the run's: the next request goes on where this one stopped. Nobody presses anything, and it is
				// so for a conversation left behind too.
				show(() => patchTurn(id, (turn) => ({ ...turn, status: "running", end: null })));
				return listen({ resume: id }, id, here, false);
			}
			// The person said stop and the run finished all the same: what waits is not asked behind their back.
			if (mine()) settle(here, here.stopAsked ? "stopped" : end.status);
		},
		[streams, patchTurn, readState, t, setQueue, follow, settle, tellStop],
	);

	/**
	 * Runs one screen tool in the browser and says what happened, as the model reads it. `called`: whether the run still asks for it when the
	 * screen is about to move (the person may have stopped the run, or opened another conversation, while the entry was read).
	 */
	const runScreenTool = useCallback(
		async (
			tool: ScreenCall,
			called: () => boolean,
		): Promise<{ id: string; output?: unknown; error?: string; why?: MoveRefusal }> => {
			// One guard for every screen tool: a screen with unsaved changes does not move, and nothing is asked. The assistant is told, and
			// tells the person.
			if (unsaved() > 0) {
				// Kept, for "save and open": only when what is unsaved can be saved from here.
				if (called() && saving.can()) setBlocked({ call: tool, at: here_.current });
				return { id: tool.id, error: "The screen has unsaved changes, so it did not move.", why: "unsaved" };
			}
			const stopped = { id: tool.id, error: "The run was stopped before the screen moved.", why: "cannot" as const };
			if (tool.name === "screen.openEntry") {
				const entryId = (tool.input as { id?: string } | null)?.id ?? "";
				const read = await call<{ entry: { collection: string; title: string } }>("entries.get", { id: entryId });
				if (!read.ok) return { id: tool.id, error: "There is no such entry.", why: "noEntry" };
				if (!called()) return stopped;
				go({ screen: "entry", collection: read.body.entry.collection, id: entryId });
				return { id: tool.id, output: { opened: read.body.entry.title } };
			}
			if (!called()) return stopped;
			return screen.run(tool.name, tool.input)
				? { id: tool.id, output: { done: true } }
				: { id: tool.id, error: "The screen that is open cannot do that.", why: "cannot" };
		},
		[screen, unsaved, call, go, saving, setBlocked],
	);
	/**
	 * "Save and open": saves the open screen with its own save, then does what the assistant had asked of it. `true` only when the screen
	 * moved. It does not move when the save was refused (the screen says so itself), when something was typed while it was saved (the page
	 * stays with it, and the step stays), when a new request, another conversation or another screen ended the step meanwhile, or when the
	 * move itself is refused (the entry is gone): that is said under the answer, and the step stays.
	 */
	const saveAndOpen = useCallback(async () => {
		const asked = step.current;
		if (!asked) return false;
		setMoveRefused(null);
		// Through the save and the move: either may change the screen's address (a new template goes to its own page, the move goes
		// where it was asked), and that is the step's own doing, not the person leaving the screen.
		savingStep.current = true;
		try {
			const outcome = await saving.save();
			if (outcome !== "saved" || step.current !== asked) return false;
			const moved = await runScreenTool(asked.call, () => step.current === asked);
			if (step.current !== asked) return false;
			if (moved.error !== undefined) {
				setMoveRefused(moved.why ?? "cannot");
				return false;
			}
			setBlocked(null);
			return true;
		} finally {
			savingStep.current = false;
		}
	}, [saving, runScreenTool, setBlocked]);

	/**
	 * Reads a run that is going without this page listening (another tab has it, or its request was cut), until it is no longer going; then
	 * goes on with it, or says how it ended. `mayGoOn` false: it only reads, and goes on with nothing by itself.
	 */
	const watch = useCallback(
		async (runId: string, here: Shown, mayGoOn = true) => {
			if (gone.current) return;
			const { controller, mine, done } = follow(here);
			const conversation = here.conversationId;
			let waited = 0;
			try {
				for (;;) {
					const read = conversation ? await readConversation(conversation, here) : null;
					if (controller.signal.aborted || !mine()) return;
					// Deleted meanwhile (in another tab): a new conversation.
					if (read === "gone") return later.current.fresh();
					const run = read?.runs.find((each) => each.id === runId);
					if (!run) {
						// No answer (the network is down): the run may still be going, and this page cannot know. It shows as cut, with the
						// way to go on.
						patchTurn(runId, (turn) =>
							turn.status === "running"
								? { ...turn, status: "interrupted", end: { status: "interrupted", reason: "connection" } }
								: turn,
						);
						return settle(here, null);
					}
					const resume = mayGoOn && !here.stopAsked;
					// A run that waits on a screen is another page's for a moment (it runs the tool and goes on). One that still waits at the
					// next look has no page. This one takes it up as a page that was not asked (`away`): nothing moves on its screen for
					// something asked before it was here, the model is told so, and the run goes on.
					const pause = run.status === "running" || (run.status === "waiting" && resume && waited === 0);
					if (pause) {
						waited = run.status === "waiting" ? 1 : 0;
						setBusy(true);
						await new Promise<void>((resolve) => {
							const timer = setTimeout(resolve, POLL_MS);
							controller.signal.addEventListener("abort", () => {
								clearTimeout(timer);
								resolve();
							});
						});
						if (controller.signal.aborted || !mine()) return;
						continue;
					}
					// It stopped where its request was cut. The browser goes on with it by itself, unless that keeps happening at the same place.
					const cutShort = run.status === "interrupted" && here.cuts > 0 && here.cuts < CUTS_BEFORE_ASKING;
					if (resume && (run.status === "waiting" || cutShort)) {
						patchTurn(runId, (turn) => ({ ...turn, status: "running", end: null }));
						return listen({ resume: runId, ...(run.status === "waiting" ? { away: true } : {}) }, runId, here, false);
					}
					// It ended while nobody listened: as when its end is heard, the box is free and what waited behind a finished run is asked
					// (not behind a stop).
					return settle(here, here.stopAsked ? "stopped" : run.status);
				}
			} finally {
				done();
			}
		},
		[readConversation, patchTurn, listen, follow, settle],
	);

	const ask = useCallback(
		(request: string) => {
			const words = request.trim();
			if (words === "") return;
			const here = shown.current;
			const { model: chosen, thinking: think, screenContext: on, removed: off } = sending.current;
			const screenGoes = contextWithout(on, off);
			// What is not saved yet goes with the screen (its chip): the request is about what the person sees, not what was saved last.
			const draftNow = screenGoes && !off.has("screen") ? unsavedOf.current?.() : undefined;
			const context = screenGoes && draftNow ? { ...screenGoes, draft: draftNow } : screenGoes;
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
			here.cuts = 0;
			here.stopAsked = false;
			here.asked.add(id);
			setBlocked(null);
			// The model a request goes with is the conversation's from then on, as the server keeps it: if it goes, the panel can say so.
			if (chosen) setPicked(chosen);
			void listen(
				{
					...(here.conversationId ? { conversation: here.conversationId } : {}),
					request: words,
					...(context ? { context } : {}),
					...(chosen ? { model: chosen } : {}),
					thinking: think,
				},
				id,
				here,
			);
		},
		[listen, chipLabels, setBlocked],
	);

	later.current = { ...later.current, ask, watch, runScreenTool };

	const stop = useCallback(() => {
		const here = shown.current;
		const last = live.current.turns.at(-1);
		// One stop for a run: a second press, or the repeats of a key held on the button, say nothing more.
		if (!last || here.stopAsked) return;
		// From here on nothing goes on with the run by itself: not after a screen tool, not after one request's time is up.
		here.stopAsked = true;
		// It shows as stopped at once: what was still going has no result, and its line goes.
		patchTurn(last.id, (turn) => ({
			...turn,
			status: "stopped",
			end: { status: "stopped" },
			parts: turn.parts.filter((part) => !(part.type === "tool" && part.state === "running")),
		}));
		// A run that has not said its id yet may already be open on the server: it is told to stop when it says its id (`listen`).
		if (local(last.id)) return;
		// The run is told to stop and ends by itself: its request stays listened to, so the run ends as stopped and not as cut off, and a new
		// request is taken once it has. What was said to it and not taken comes back with its end, or here when it was only waiting.
		tellStop(last.id, here);
	}, [patchTurn, tellStop]);

	const goOn = useCallback(
		(more = false) => {
			const here = shown.current;
			const last = live.current.turns.at(-1);
			if (!last || local(last.id)) return;
			here.cuts = 0;
			here.stopAsked = false;
			// A run that waits on a screen goes on with what this page's screen answered, if the request that carried it did not get
			// through; otherwise as a page that was not asked (nothing moves, the model is told).
			const answered = here.unsent?.run === last.id ? here.unsent.screen : null;
			here.unsent = null;
			const onScreen = answered ? { screen: answered } : last.status === "waiting" ? { away: true } : {};
			patchTurn(last.id, (turn) => ({ ...turn, status: "running", end: null }));
			void listen({ resume: last.id, ...(more ? { more: true } : {}), ...onScreen }, last.id, here);
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

	/**
	 * Makes another conversation the open one, or none. What followed the one that was open is let be: its run is not cut and goes on, and
	 * shows nothing here any more. The words that waited behind it are dropped with it, as they are when "+" is pressed.
	 */
	const turnTo = useCallback(
		(id: string | null): Shown => {
			const here = showing(id);
			shown.current = here;
			setBusy(false);
			setQueue([]);
			// The requests of the one that was open go at once: what is asked while the next one is read stands by itself, and is kept.
			setTurns([]);
			setEarlier(null);
			setForgotten(0);
			setRequests(0);
			setLoading(id !== null);
			setBlocked(null);
			setConversationId(id);
			keep({ conversation: id });
			setView("chat");
			return here;
		},
		[setQueue, setBlocked],
	);

	const fresh = useCallback(() => {
		// A run that is going goes on; it is in the past conversations.
		turnTo(null);
		setPicked(null);
		setLevel(null);
	}, [turnTo]);

	later.current.fresh = fresh;

	const load = useCallback(
		async (id: string) => {
			const here = turnTo(id);
			const read = await readConversation(id, here);
			if (gone.current || shown.current !== here) return;
			setLoading(false);
			// It was deleted meanwhile (here or in another tab): a new one. No answer: nothing to show of it, and it stays the open one.
			if (read === "gone") return fresh();
			if (!read) return;
			// What was sent to its run with "send now" and never taken, while it was not open, stands over the box again.
			const left = leftWords.current.get(id);
			leftWords.current.delete(id);
			if (left) setQueue((waiting) => [...left.map(named), ...waiting]);
			// A run that is going elsewhere shows as going, and is read again until it is not.
			const last = read.runs.at(-1);
			if (last && (last.status === "running" || last.status === "waiting")) return void watch(last.id, here);
			// Nothing is going in it: what was said to be sent now is asked.
			if (left && !here.following) settle(here, "done");
		},
		[readConversation, watch, turnTo, fresh, setQueue, settle],
	);
	const openConversation = useCallback(
		async (id: string) => {
			const here = shown.current;
			// The one that is open already: its run, what waits behind it and what was said to it stay as they are.
			if (here.conversationId === id) {
				setView("chat");
				// Nothing is going in it: it is read again, for what another tab did to it.
				if (!live.current.busy) await readConversation(id, here);
				return;
			}
			await load(id);
		},
		[readConversation, load],
	);
	// The conversation that was open comes back with the page.
	const restored = useRef(false);
	useEffect(() => {
		if (restored.current || available !== true) return;
		restored.current = true;
		const id = kept().conversation;
		if (id) void load(id);
	}, [available, load]);

	const loadEarlier = useCallback(async () => {
		const here = shown.current;
		const id = here.conversationId;
		// One read of the requests before these at a time: the thread says it is at its top with every scroll event.
		if (!id || !here.earlier || here.loadingEarlier) return;
		here.loadingEarlier = true;
		try {
			const read = await call<Conversation>("conversations.get", { id, before: here.earlier });
			if (!read.ok || gone.current || shown.current !== here) return;
			here.earlier = read.body.earlier;
			setEarlier(read.body.earlier);
			setTurns((now) => {
				const have = new Set(now.map((turn) => turn.id));
				return [...read.body.runs.filter((run) => !have.has(run.id)).map((run) => turnOf(run, chipLabels)), ...now];
			});
		} finally {
			here.loadingEarlier = false;
		}
	}, [call, chipLabels]);

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
			if (!gone.current && shown.current.conversationId === id) fresh();
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
		loading,
		screenKind: screenContext?.screen ?? null,
		hasEarlier: earlier !== null,
		loadEarlier,
		busy,
		draft,
		setDraft,
		queue,
		queueAdd: (words) => setQueue((waiting) => [...waiting, named(words)]),
		queueTake: (id) => {
			const item = queueNow.current.find((each) => each.id === id);
			if (!item) return;
			setDraft(item.text);
			setQueue((waiting) => waiting.filter((each) => each.id !== id));
		},
		queueCancel: (id) => setQueue((waiting) => waiting.filter((each) => each.id !== id)),
		queueSendNow: (id) => {
			const here = shown.current;
			const item = queueNow.current.find((each) => each.id === id);
			const last = live.current.turns.at(-1);
			// A run that has not said its id yet cannot be told anything: the words wait.
			if (!item || !last || local(last.id)) return;
			setQueue((waiting) => waiting.filter((each) => each.id !== id));
			// The run takes it in before its next turn and says so (`taken`); if it ends first, its end hands the words back.
			void call("assistant.say", { run: last.id, text: item.text }).then((said) => {
				if (!said.ok && !gone.current && shown.current === here) setQueue((waiting) => [item, ...waiting]);
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
		refreshModels,
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
		setScreenUnsaved,
		blockedMove: blocked !== null,
		saveAndOpen,
		moveRefused,
		proposalTick,
		touchProposals,
		openReview: (id) => leave(() => go({ screen: "review", id })),
		request: () => {
			setOpen(true);
			setView("chat");
			setRemoved((was) => (was.has("selection") ? new Set([...was].filter((id) => id !== "selection")) : was));
			setRequested((count) => count + 1);
		},
		requested,
	};
	return <Context.Provider value={value}>{children}</Context.Provider>;
}

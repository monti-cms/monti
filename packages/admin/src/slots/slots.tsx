"use client";

import { createTranslator } from "@monti-cms/core/client";
import { RefreshCw, X, Zap } from "lucide-react";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { cn } from "../lib/utils/cn";
import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { IconButton } from "../ui/icon-button";
import { Spinner } from "../ui/spinner";
import { Textarea } from "../ui/textarea";
import { slotsMessages } from "./messages";

const t = createTranslator(slotsMessages);

/**
 * Screen slots. Named slots are placed throughout the CMS UI, and the actions attached to a slot are rendered as buttons.
 *
 * - A slot only passes the current context (`getContext`) and the apply function (`apply`). It does not know which actions are attached.
 * - Actions are decided by the sources in `SlotRegistryProvider`. AI features (the definitions on the admin AI screen) are one such source.
 * - An action does not change values itself. It shows results, and `apply` runs only when the user clicks a candidate.
 * - Run state (generating, results) is held by `SlotRegistryProvider`, not by the element that renders the slot. Closing a popover or panel
 *   does not stop the request, and reopening shows the same result. The same slot is distinguished by `scope` (entry, image, etc.).
 */

/**
 * Slot names used by the core. `field` is next to a field, `image` is a body image, `codeRules` is code block rules, `media` is media detail.
 * `translation` is the translation editor (block translation).
 */
export const CORE_SLOT_NAMES = ["field", "image", "codeRules", "media", "translation"] as const;
export type CoreSlotName = (typeof CORE_SLOT_NAMES)[number];
/** Slot name. Any string works, and the core uses only `CORE_SLOT_NAMES`. Extensions and sites can place slots with their own names. */
export type SlotName = string;

/** One candidate shown as a result. `value` is the value to apply and `label` is the visible text. */
export interface SlotCandidate {
	value: string;
	label: string;
	/** A short note to append (e.g. the number of places a regex matched). */
	detail?: string;
}

/** An action's result. Multiple candidates, long text, a body fragment (MDX), or a display-only note. */
export type SlotResult =
	| { kind: "candidates"; items: SlotCandidate[] }
	| { kind: "text"; text: string }
	| { kind: "mdx"; text: string }
	| { kind: "note"; text: string };

/** The current context a slot passes on click. Each slot fills in only the values it knows. */
export interface SlotContext {
	/** Extra request typed when running. Received only when the action is `askInstruction`. */
	request?: string;
	collection?: string;
	locale?: string;
	entryId?: string;
	title?: string;
	summary?: string;
	body?: string;
	/** The target's current value. List values (tag ids, etc.) are arrays. */
	current?: string | readonly string[];
	around?: string;
	code?: string;
	language?: string;
	mediaId?: string;
	/** Site path of an image outside the media library (`/images/...`). */
	imageSrc?: string;
	filename?: string;
}
export type SlotApplyMode = "replace" | "append";

export interface SlotRequest {
	slot: SlotName;
	/** The target within the slot (field name, `alt`, `fold`, etc.). */
	target: string;
	/** The collection of a field slot. */
	collection?: string;
	/** The current context, read on click. */
	getContext: () => SlotContext;
	apply: (value: string, mode: SlotApplyMode) => void;
	disabled?: boolean;
	/** A value that distinguishes multiple slots with the same name and target (entry ID, image URL, etc.). Run state is kept separately per value. */
	scope?: string;
}

export interface SlotAction {
	id: string;
	/** Name shown on the button, menu item and result panel header. */
	label: string;
	/** Icon for the button, menu item and result panel header. Falls back to the default icon when absent. */
	icon?: ReactNode;
	/** Name of the menu button when multiple actions are grouped into one menu. Defaults to the first action's `label`. */
	menuLabel?: string;
	/** Icon of the menu button when multiple actions are grouped into one menu. Defaults to the first action's `icon`. */
	menuIcon?: ReactNode;
	/** How the result is applied. `none` means display only. */
	apply: SlotApplyMode | "none";
	/** Takes an extra request when running. Clicking opens the request input first instead of running immediately. */
	askInstruction?: boolean;
	/** Inserts the result immediately without showing it (the first candidate). Notifies in the result panel when there is nothing to insert. */
	instant?: boolean;
	run: (context: SlotContext, signal: AbortSignal) => Promise<SlotResult>;
}

/** A source that returns the actions to attach to a slot. */
export type SlotSource = (request: Pick<SlotRequest, "slot" | "target" | "collection">) => readonly SlotAction[];

type RunState =
	| { status: "idle" }
	| { status: "asking"; action: SlotAction }
	| { status: "running"; action: SlotAction }
	| { status: "done"; action: SlotAction; result: SlotResult }
	| { status: "error"; action: SlotAction; message: string };

const IDLE: RunState = { status: "idle" };

/** Icon used when an action does not provide one. */
const defaultIcon = <Zap aria-hidden />;

/** Per-slot run state. It persists even after the UI fragment disappears. */
interface SlotRuns {
	get: (key: string) => RunState;
	set: (key: string, state: RunState) => void;
	subscribe: (key: string, listener: () => void) => () => void;
	/** Starts a new run. Stops the previous run of the same slot. */
	begin: (key: string) => AbortController;
	/** Stops the run of the same slot. */
	abort: (key: string) => void;
	/** Whether this run is still the latest run of that slot. */
	isCurrent: (key: string, controller: AbortController) => boolean;
}

function createSlotRuns(): SlotRuns {
	const states = new Map<string, RunState>();
	const controllers = new Map<string, AbortController>();
	const listeners = new Map<string, Set<() => void>>();
	return {
		get: (key) => states.get(key) ?? IDLE,
		set: (key, state) => {
			if (state.status === "idle") states.delete(key);
			else states.set(key, state);
			for (const listener of listeners.get(key) ?? []) listener();
		},
		subscribe: (key, listener) => {
			const set = listeners.get(key) ?? new Set();
			set.add(listener);
			listeners.set(key, set);
			return () => {
				set.delete(listener);
				if (set.size === 0) listeners.delete(key);
			};
		},
		begin: (key) => {
			controllers.get(key)?.abort();
			const controller = new AbortController();
			controllers.set(key, controller);
			return controller;
		},
		abort: (key) => {
			controllers.get(key)?.abort();
			controllers.delete(key);
		},
		isCurrent: (key, controller) => controllers.get(key) === controller && !controller.signal.aborted,
	};
}

const SlotRegistryContext = createContext<readonly SlotSource[]>([]);
const SlotRunsContext = createContext<SlotRuns | null>(null);

export function SlotRegistryProvider({ sources, children }: { sources: readonly SlotSource[]; children: ReactNode }) {
	const parent = useContext(SlotRegistryContext);
	const value = useMemo(() => [...parent, ...sources], [parent, sources]);
	// Run state is held by a single outermost provider (one for the whole admin UI).
	const parentRuns = useContext(SlotRunsContext);
	const [ownRuns] = useState(() => (parentRuns ? null : createSlotRuns()));
	const runs = parentRuns ?? (ownRuns as SlotRuns);
	return (
		<SlotRunsContext.Provider value={runs}>
			<SlotRegistryContext.Provider value={value}>{children}</SlotRegistryContext.Provider>
		</SlotRunsContext.Provider>
	);
}

/** Shape of one result candidate. The AI screen's test results use the same shape. */
export const SLOT_CHIP = "inline-flex max-w-full items-center gap-1 rounded-full border bg-cms-background px-2 py-0.5";

const errorMessage = (error: unknown) => (error instanceof Error && error.message ? error.message : t("failed"));

/**
 * The button (`trigger`) and result panel (`panel`) of one slot. The button goes next to the label and the result below the input.
 * Both are `null` when no action is attached.
 */
export function useSlot(request: SlotRequest): { trigger: ReactNode; panel: ReactNode } {
	const sources = useContext(SlotRegistryContext);
	const { slot, target, collection } = request;
	const actions = useMemo(
		() => sources.flatMap((source) => source({ slot, target, collection })),
		[sources, slot, target, collection],
	);
	// Outside a provider (tests, standalone screens), this element holds the run state.
	const [localRuns] = useState(createSlotRuns);
	const runs = useContext(SlotRunsContext) ?? localRuns;
	const key = `${slot}|${target}|${collection ?? ""}|${request.scope ?? ""}`;
	const state = useSyncExternalStore(
		useCallback((listener: () => void) => runs.subscribe(key, listener), [runs, key]),
		() => runs.get(key),
		() => IDLE,
	);
	/** Extra request. It stays when running again in the same slot. */
	const [instruction, setInstruction] = useState("");
	const requestRef = useRef(request);
	requestRef.current = request;

	// It does not stop even if it disappears from the screen. The result stays in `runs` and shows when reopened.
	const run = useCallback(
		async (action: SlotAction, extra: string) => {
			const controller = runs.begin(key);
			runs.set(key, { status: "running", action });
			const context = requestRef.current.getContext();
			const request = action.askInstruction ? extra.trim() : "";
			try {
				const result = await action.run(request ? { ...context, request } : context, controller.signal);
				if (!runs.isCurrent(key, controller)) return;
				const value =
					result.kind === "candidates" ? result.items[0]?.value : result.kind === "text" ? result.text : undefined;
				if (action.instant && action.apply !== "none" && value) {
					requestRef.current.apply(value, action.apply);
					runs.set(key, IDLE);
					return;
				}
				runs.set(key, { status: "done", action, result });
			} catch (error) {
				if (runs.isCurrent(key, controller)) runs.set(key, { status: "error", action, message: errorMessage(error) });
			}
		},
		[runs, key],
	);

	/** Button click. For an action that takes a request, opens the input first; otherwise runs immediately. */
	const start = (action: SlotAction) => {
		if (action.askInstruction) {
			runs.abort(key);
			runs.set(key, { status: "asking", action });
		} else void run(action, "");
	};

	const close = useCallback(() => {
		runs.abort(key);
		runs.set(key, IDLE);
	}, [runs, key]);

	/** Inserts the result. The same candidate can be inserted any number of times (clear, then insert again, etc.). */
	const applyValue = (value: string) => {
		if (state.status !== "done" || state.action.apply === "none") return;
		requestRef.current.apply(value, state.action.apply);
	};

	if (actions.length === 0) return { trigger: null, panel: null };

	const busy = state.status === "running";
	const disabled = request.disabled || busy;
	const first = actions[0];
	const triggerIcon = busy ? (
		<Spinner className="size-3" />
	) : actions.length === 1 ? (
		(first?.icon ?? defaultIcon)
	) : (
		(first?.menuIcon ?? first?.icon ?? defaultIcon)
	);
	const trigger =
		actions.length === 1 ? (
			<IconButton
				label={first?.label ?? ""}
				size="icon-xs"
				side="bottom"
				disabled={disabled}
				onClick={() => actions[0] && start(actions[0])}
				className="text-cms-muted-foreground hover:text-cms-foreground"
			>
				{triggerIcon}
			</IconButton>
		) : (
			<DropdownMenu>
				<IconButton
					label={first?.menuLabel ?? first?.label ?? ""}
					size="icon-xs"
					side="bottom"
					disabled={disabled}
					className="text-cms-muted-foreground hover:text-cms-foreground"
					trigger={(button) => <DropdownMenuTrigger render={button} />}
				>
					{triggerIcon}
				</IconButton>
				<DropdownMenuContent align="end">
					{actions.map((action) => (
						<DropdownMenuItem key={action.id} onClick={() => start(action)}>
							{action.icon ?? defaultIcon}
							{action.label}
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
		);

	// While generating, it is shown by the button's spinning icon. The result panel opens only when a result or error appears or a request is taken.
	const panel =
		state.status === "idle" || (state.status === "running" && !state.action.askInstruction) ? null : (
			<div className="flex flex-col gap-1.5 rounded-md border bg-cms-muted/30 p-2 text-xs" aria-live="polite">
				<div className="flex items-center gap-1 text-cms-muted-foreground">
					<span className="inline-flex shrink-0 items-center [&_svg]:size-3">{state.action.icon ?? defaultIcon}</span>
					<span className="truncate">{state.action.label}</span>
					<span className="ml-auto flex items-center">
						{state.status !== "running" && state.status !== "asking" && (
							<IconButton label={t("rerun")} size="icon-xs" onClick={() => void run(state.action, instruction)}>
								<RefreshCw aria-hidden />
							</IconButton>
						)}
						<IconButton label={t("close")} size="icon-xs" onClick={close}>
							<X aria-hidden />
						</IconButton>
					</span>
				</div>
				{state.action.askInstruction && (
					<form
						className="flex flex-col gap-1.5"
						onSubmit={(event) => {
							event.preventDefault();
							if (state.status !== "running") void run(state.action, instruction);
						}}
					>
						<Textarea
							aria-label={t("instruction")}
							placeholder={t("instruction")}
							value={instruction}
							rows={2}
							maxLength={1000}
							autoFocus={state.status === "asking"}
							disabled={state.status === "running"}
							onChange={(event) => setInstruction(event.target.value)}
							onKeyDown={(event) => {
								// Keeps keys from leaking into the body even inside the editor. Enter is a newline; Cmd/Ctrl+Enter runs.
								event.stopPropagation();
								if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing) {
									event.preventDefault();
									if (state.status !== "running") void run(state.action, instruction);
								}
							}}
							className="min-h-14 resize-y bg-cms-background text-xs md:text-xs"
						/>
						<Button
							type="submit"
							variant="outline"
							size="xs"
							className="self-end"
							disabled={state.status === "running"}
						>
							{state.action.icon ?? defaultIcon}
							{state.status === "running" ? t("running") : t("run")}
						</Button>
					</form>
				)}
				{state.status === "error" && (
					<p role="alert" className="text-cms-destructive">
						{state.message}
					</p>
				)}
				{state.status === "done" && <SlotResult state={state} onApply={applyValue} />}
			</div>
		);

	return { trigger, panel };
}

function SlotResult({
	state,
	onApply,
}: {
	state: Extract<RunState, { status: "done" }>;
	onApply: (value: string) => void;
}) {
	const { result, action } = state;
	if (result.kind === "candidates") {
		if (result.items.length === 0) return <p className="text-cms-muted-foreground">{t("noResults")}</p>;
		return (
			<ul className="flex flex-wrap gap-1">
				{result.items.map((item) => (
					<li key={item.value} className="max-w-full">
						<button
							type="button"
							onClick={() => onApply(item.value)}
							title={item.label}
							className={cn(SLOT_CHIP, "text-left hover:bg-cms-accent")}
						>
							<span className="truncate">{item.label}</span>
							{item.detail && <span className="shrink-0 text-cms-muted-foreground">{item.detail}</span>}
						</button>
					</li>
				))}
			</ul>
		);
	}
	return (
		<div className="flex flex-col gap-1.5">
			<p className="whitespace-pre-wrap rounded border bg-cms-background p-2">{result.text}</p>
			{result.kind === "text" && action.apply !== "none" && (
				<Button type="button" size="xs" variant="outline" className="self-start" onClick={() => onApply(result.text)}>
					{action.apply === "append" ? t("insert") : t("replace")}
				</Button>
			)}
		</div>
	);
}

/** Wrapper for using slots inside loops and conditions. Run state is kept per `request.scope`. */
export function SlotScope({
	request,
	children,
}: {
	request: SlotRequest;
	children: (slot: { trigger: ReactNode; panel: ReactNode }) => ReactNode;
}) {
	return <>{children(useSlot(request))}</>;
}

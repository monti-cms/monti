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
 * 화면 자리(slot). CMS 화면 곳곳에 이름 붙은 자리를 두고, 자리에 연결된 동작을 버튼으로 그린다.
 *
 * - 자리는 지금 상황(`getContext`)과 적용 함수(`apply`)만 넘긴다. 어떤 동작이 붙는지는 모른다.
 * - 동작은 `SlotRegistryProvider`의 공급원이 정한다. AI 기능(관리자 AI 화면의 정의)도 공급원 하나다.
 * - 동작은 값을 직접 바꾸지 않는다. 결과를 보여 주고, 사용자가 후보를 눌러야 `apply`로 적용한다.
 * - 실행 상태(만드는 중·결과)는 자리를 그린 요소가 아니라 `SlotRegistryProvider`가 들고 있다. 팝오버·패널을 닫아도
 *   요청은 계속되고, 다시 열면 결과가 그대로 있다. 같은 자리는 `scope`(항목·이미지 등)로 구분한다.
 */

/**
 * 본체가 쓰는 자리 이름. `field`는 필드 옆, `image`는 본문 이미지, `codeRules`는 코드 블록 규칙, `media`는 미디어 상세다.
 * `translation`은 번역본 편집기(블록 번역)다.
 */
export const CORE_SLOT_NAMES = ["field", "image", "codeRules", "media", "translation"] as const;
export type CoreSlotName = (typeof CORE_SLOT_NAMES)[number];
/** 자리 이름. 어떤 문자열이든 되고, 본체는 `CORE_SLOT_NAMES`만 쓴다. 확장·사이트는 자기 이름의 자리를 둘 수 있다. */
export type SlotName = string;

/** 결과로 보여 줄 후보 하나. `value`가 적용될 값이고 `label`은 보이는 글자다. */
export interface SlotCandidate {
	value: string;
	label: string;
	/** 덧붙일 짧은 설명(정규식이 찾은 곳 수 등). */
	detail?: string;
}

/** 동작의 결과. 후보 여러 개·긴 글·본문 조각(MDX)·보여 주기만 하는 메모다. */
export type SlotResult =
	| { kind: "candidates"; items: SlotCandidate[] }
	| { kind: "text"; text: string }
	| { kind: "mdx"; text: string }
	| { kind: "note"; text: string };

/** 자리가 누를 때 넘기는 지금 상황. 자리마다 아는 값만 채운다. */
export interface SlotContext {
	/** 실행할 때 적은 추가 요청. 동작이 `askInstruction`일 때만 받는다. */
	request?: string;
	collection?: string;
	locale?: string;
	entryId?: string;
	title?: string;
	summary?: string;
	body?: string;
	/** 대상의 현재 값. 목록 값(태그 id 등)은 배열이다. */
	current?: string | readonly string[];
	around?: string;
	code?: string;
	language?: string;
	mediaId?: string;
	/** 미디어 라이브러리 밖 이미지의 사이트 주소(`/images/...`). */
	imageSrc?: string;
	filename?: string;
}
export type SlotApplyMode = "replace" | "append";

export interface SlotRequest {
	slot: SlotName;
	/** 자리 안의 대상(필드 이름, `alt`, `fold` 등). */
	target: string;
	/** 필드 자리의 컬렉션. */
	collection?: string;
	/** 누를 때 읽는 지금 상황. */
	getContext: () => SlotContext;
	apply: (value: string, mode: SlotApplyMode) => void;
	disabled?: boolean;
	/** 같은 자리·대상이 여럿일 때 구분하는 값(항목 ID, 이미지 주소 등). 실행 상태는 이 값별로 따로 남는다. */
	scope?: string;
}

export interface SlotAction {
	id: string;
	/** 버튼·메뉴 항목·결과 칸 머리에 보일 이름. */
	label: string;
	/** 버튼·메뉴 항목·결과 칸 머리의 아이콘. 없으면 기본 아이콘을 쓴다. */
	icon?: ReactNode;
	/** 동작이 여럿이라 한 메뉴로 묶일 때, 메뉴 버튼의 이름. 없으면 첫 동작의 `label`이다. */
	menuLabel?: string;
	/** 동작이 여럿이라 한 메뉴로 묶일 때, 메뉴 버튼의 아이콘. 없으면 첫 동작의 `icon`이다. */
	menuIcon?: ReactNode;
	/** 결과를 적용하는 방식. `none`이면 보여 주기만 한다. */
	apply: SlotApplyMode | "none";
	/** 실행할 때 추가 요청을 받는다. 누르면 바로 실행하지 않고 요청 입력을 먼저 연다. */
	askInstruction?: boolean;
	/** 결과를 보여 주지 않고 바로 넣는다(후보는 첫 후보). 넣을 것이 없으면 결과 칸에 알린다. */
	instant?: boolean;
	run: (context: SlotContext, signal: AbortSignal) => Promise<SlotResult>;
}

/** 자리에 붙을 동작을 돌려주는 공급원. */
export type SlotSource = (request: Pick<SlotRequest, "slot" | "target" | "collection">) => readonly SlotAction[];

type RunState =
	| { status: "idle" }
	| { status: "asking"; action: SlotAction }
	| { status: "running"; action: SlotAction }
	| { status: "done"; action: SlotAction; result: SlotResult }
	| { status: "error"; action: SlotAction; message: string };

const IDLE: RunState = { status: "idle" };

/** 동작이 아이콘을 주지 않았을 때의 아이콘. */
const defaultIcon = <Zap aria-hidden />;

/** 자리별 실행 상태. 화면 조각이 사라져도 남는다. */
interface SlotRuns {
	get: (key: string) => RunState;
	set: (key: string, state: RunState) => void;
	subscribe: (key: string, listener: () => void) => () => void;
	/** 새 실행을 시작한다. 같은 자리의 이전 실행은 멈춘다. */
	begin: (key: string) => AbortController;
	/** 같은 자리의 실행을 멈춘다. */
	abort: (key: string) => void;
	/** 이 실행이 아직 그 자리의 최신 실행인가. */
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
	// 실행 상태는 가장 바깥 공급자 하나가 든다(관리자 화면 전체에서 하나).
	const parentRuns = useContext(SlotRunsContext);
	const [ownRuns] = useState(() => (parentRuns ? null : createSlotRuns()));
	const runs = parentRuns ?? (ownRuns as SlotRuns);
	return (
		<SlotRunsContext.Provider value={runs}>
			<SlotRegistryContext.Provider value={value}>{children}</SlotRegistryContext.Provider>
		</SlotRunsContext.Provider>
	);
}

/** 결과 후보 하나의 모양. AI 화면의 시험 결과도 같은 모양을 쓴다. */
export const SLOT_CHIP = "inline-flex max-w-full items-center gap-1 rounded-full border bg-cms-background px-2 py-0.5";

const errorMessage = (error: unknown) => (error instanceof Error && error.message ? error.message : t("failed"));

/**
 * 자리 하나의 버튼(`trigger`)과 결과 칸(`panel`). 자리마다 버튼은 라벨 옆에, 결과는 입력 아래에 둔다.
 * 연결된 동작이 없으면 둘 다 `null`이다.
 */
export function useSlot(request: SlotRequest): { trigger: ReactNode; panel: ReactNode } {
	const sources = useContext(SlotRegistryContext);
	const { slot, target, collection } = request;
	const actions = useMemo(
		() => sources.flatMap((source) => source({ slot, target, collection })),
		[sources, slot, target, collection],
	);
	// 공급자 밖(테스트·단독 화면)에서는 이 요소가 실행 상태를 든다.
	const [localRuns] = useState(createSlotRuns);
	const runs = useContext(SlotRunsContext) ?? localRuns;
	const key = `${slot}|${target}|${collection ?? ""}|${request.scope ?? ""}`;
	const state = useSyncExternalStore(
		useCallback((listener: () => void) => runs.subscribe(key, listener), [runs, key]),
		() => runs.get(key),
		() => IDLE,
	);
	/** 추가 요청. 같은 자리에서 다시 실행할 때 그대로 남는다. */
	const [instruction, setInstruction] = useState("");
	const requestRef = useRef(request);
	requestRef.current = request;

	// 화면에서 사라져도 멈추지 않는다. 결과는 `runs`에 남아 다시 열면 보인다.
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

	/** 버튼을 누름. 요청을 받는 동작이면 입력을 먼저 열고, 아니면 바로 실행한다. */
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

	/** 결과를 넣는다. 같은 후보를 몇 번이든 다시 넣을 수 있다(지웠다가 다시 넣기 등). */
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

	// 만드는 동안은 버튼의 도는 아이콘으로 알린다. 결과 칸은 결과·오류가 나오거나 요청을 받을 때만 연다.
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
								// 편집기 안에서도 키가 본문으로 새지 않게 한다. 줄바꿈은 Enter, 실행은 Cmd/Ctrl+Enter다.
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

/** 반복문·조건 안에서 자리를 쓸 때의 감싸개. 실행 상태는 `request.scope`별로 남는다. */
export function SlotScope({
	request,
	children,
}: {
	request: SlotRequest;
	children: (slot: { trigger: ReactNode; panel: ReactNode }) => ReactNode;
}) {
	return <>{children(useSlot(request))}</>;
}

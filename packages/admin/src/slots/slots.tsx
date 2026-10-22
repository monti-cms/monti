"use client";

import { useTranslator } from "@monti-cms/core/site";
import {
	Button,
	cn,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	IconButton,
	Spinner,
	Textarea,
} from "@monti-cms/ui";
import { RefreshCw, X, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { commonMessages } from "../lib/common.messages";
import { isComposingKey } from "../lib/keyboard";
import { ErrorNoticeView } from "../ui/error-notice";
import { slotsMessages } from "./messages";
import type { SlotRequest } from "./registry";
import { type SlotRunState, useSlotActions } from "./use-slot-actions";

export {
	CORE_SLOT_NAMES,
	type CoreSlotName,
	type SlotAction,
	type SlotApplyMode,
	type SlotCandidate,
	type SlotContext,
	type SlotName,
	SlotRegistryProvider,
	type SlotRequest,
	type SlotResult,
	type SlotSource,
} from "./registry";

/**
 * Screen slots (default UI). The registry, the types and the run state live in `registry.tsx` and `use-slot-actions.ts`;
 * this file draws the button and the result panel on top of `useSlotActions`.
 */

/** Icon used when an action does not provide one. */
const defaultIcon = <Zap aria-hidden />;

/** Shape of one result candidate. The AI screen's test results use the same shape. */
export const SLOT_CHIP =
	"inline-flex max-w-full items-center gap-tight rounded-sm border bg-monti-page px-condensed py-hair";

/**
 * The button (`trigger`) and result panel (`panel`) of one slot. The button goes next to the label and the result below the input.
 * Both are `null` when no action is attached.
 */
export function useSlot(request: SlotRequest): { trigger: ReactNode; panel: ReactNode } {
	const t = useTranslator(slotsMessages);
	const tc = useTranslator(commonMessages);
	const { actions, disabled, state, instruction, setInstruction, start, run, rerun, cancel, apply } =
		useSlotActions(request);

	if (actions.length === 0) return { trigger: null, panel: null };

	const busy = state.status === "running";
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
				onClick={() => first && start(first.id)}
				className="text-monti-muted hover:text-monti-default"
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
					className="text-monti-muted hover:text-monti-default"
					trigger={(button) => <DropdownMenuTrigger render={button} />}
				>
					{triggerIcon}
				</IconButton>
				<DropdownMenuContent align="end">
					{actions.map((action) => (
						<DropdownMenuItem key={action.id} onClick={() => start(action.id)}>
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
			<div
				className="flex flex-col gap-condensed rounded-md border bg-monti-inset p-condensed text-monti-caption"
				aria-live="polite"
			>
				<div className="flex items-center gap-tight text-monti-muted">
					<span className="inline-flex shrink-0 items-center [&_svg]:size-3">{state.action.icon ?? defaultIcon}</span>
					<span className="truncate">{state.action.label}</span>
					<span className="ml-auto flex items-center">
						{state.status !== "running" && state.status !== "asking" && (
							<IconButton label={t("rerun")} size="icon-xs" onClick={() => void rerun()}>
								<RefreshCw aria-hidden />
							</IconButton>
						)}
						<IconButton label={tc("close")} size="icon-xs" onClick={cancel}>
							<X aria-hidden />
						</IconButton>
					</span>
				</div>
				{state.action.askInstruction && (
					<form
						className="flex flex-col gap-condensed"
						onSubmit={(event) => {
							event.preventDefault();
							if (state.status !== "running") void run(state.action.id);
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
								if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !isComposingKey(event)) {
									event.preventDefault();
									if (state.status !== "running") void run(state.action.id);
								}
							}}
							className="min-h-14 resize-y bg-monti-page text-monti-caption md:text-monti-caption"
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
				{state.status === "error" && <ErrorNoticeView notice={state.error} />}
				{state.status === "done" && <SlotResult state={state} onApply={apply} />}
			</div>
		);

	return { trigger, panel };
}

function SlotResult({
	state,
	onApply,
}: {
	state: Extract<SlotRunState, { status: "done" }>;
	onApply: (value: string) => void;
}) {
	const t = useTranslator(slotsMessages);
	const { result, action } = state;
	if (result.kind === "candidates") {
		if (result.items.length === 0) return <p className="text-monti-muted">{t("noResults")}</p>;
		return (
			<ul className="flex flex-wrap gap-tight">
				{result.items.map((item) => (
					<li key={item.value} className="max-w-full">
						<button
							type="button"
							onClick={() => onApply(item.value)}
							title={item.label}
							className={cn(SLOT_CHIP, "text-left hover:bg-monti-hover")}
						>
							<span className="truncate">{item.label}</span>
							{item.detail && <span className="shrink-0 text-monti-muted">{item.detail}</span>}
						</button>
					</li>
				))}
			</ul>
		);
	}
	return (
		<div className="flex flex-col gap-condensed">
			<p className="whitespace-pre-wrap rounded-lg border bg-monti-page p-condensed">{result.text}</p>
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

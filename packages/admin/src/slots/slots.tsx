"use client";

import { useTranslator } from "@monti-cms/core/client";
import { RefreshCw, X, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/utils/cn";
import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { IconButton } from "../ui/icon-button";
import { Spinner } from "../ui/spinner";
import { Textarea } from "../ui/textarea";
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
export const SLOT_CHIP = "inline-flex max-w-full items-center gap-1 rounded-full border bg-cms-background px-2 py-0.5";

/**
 * The button (`trigger`) and result panel (`panel`) of one slot. The button goes next to the label and the result below the input.
 * Both are `null` when no action is attached.
 */
export function useSlot(request: SlotRequest): { trigger: ReactNode; panel: ReactNode } {
	const t = useTranslator(slotsMessages);
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
			<div className="flex flex-col gap-1.5 rounded-md border bg-cms-muted/30 p-2 text-xs" aria-live="polite">
				<div className="flex items-center gap-1 text-cms-muted-foreground">
					<span className="inline-flex shrink-0 items-center [&_svg]:size-3">{state.action.icon ?? defaultIcon}</span>
					<span className="truncate">{state.action.label}</span>
					<span className="ml-auto flex items-center">
						{state.status !== "running" && state.status !== "asking" && (
							<IconButton label={t("rerun")} size="icon-xs" onClick={() => void rerun()}>
								<RefreshCw aria-hidden />
							</IconButton>
						)}
						<IconButton label={t("close")} size="icon-xs" onClick={cancel}>
							<X aria-hidden />
						</IconButton>
					</span>
				</div>
				{state.action.askInstruction && (
					<form
						className="flex flex-col gap-1.5"
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
								if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing) {
									event.preventDefault();
									if (state.status !== "running") void run(state.action.id);
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
						{state.error.message}
					</p>
				)}
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

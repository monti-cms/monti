"use client";

import { useTranslator } from "@monti-cms/core/site";
import {
	Box,
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	IconButton,
	Inline,
	Stack,
	Text,
	Textarea,
	TextButton,
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
	const triggerIcon =
		actions.length === 1 ? (first?.icon ?? defaultIcon) : (first?.menuIcon ?? first?.icon ?? defaultIcon);
	const trigger =
		actions.length === 1 ? (
			<IconButton
				label={first?.label ?? ""}
				side="bottom"
				pressed={busy}
				disabled={disabled}
				onClick={() => first && start(first.id)}
			>
				{triggerIcon}
			</IconButton>
		) : (
			<DropdownMenu>
				<IconButton
					label={first?.menuLabel ?? first?.label ?? ""}
					side="bottom"
					pressed={busy}
					disabled={disabled}
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

	// While generating, the button shows as pressed. The result panel opens only when a result or error appears or a request is taken.
	const panel =
		state.status === "idle" || (state.status === "running" && !state.action.askInstruction) ? null : (
			<Stack gap={8} padding={8} radius="md" border="all" background="tool" aria-live="polite">
				<Inline gap={4}>
					<Box as="span" shrink={false}>
						{state.action.icon ?? defaultIcon}
					</Box>
					<Text variant="caption" tone="muted" truncate>
						{state.action.label}
					</Text>
					<Inline as="span" grow justify="end">
						{state.status !== "running" && state.status !== "asking" && (
							<IconButton label={t("rerun")} onClick={() => void rerun()}>
								<RefreshCw aria-hidden />
							</IconButton>
						)}
						<IconButton label={tc("close")} onClick={cancel}>
							<X aria-hidden />
						</IconButton>
					</Inline>
				</Inline>
				{state.action.askInstruction && (
					<Stack
						as="form"
						gap={8}
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
							size="sm"
						/>
						<Inline justify="end">
							<Button type="submit" variant="secondary" size="sm" disabled={state.status === "running"}>
								{state.action.icon ?? defaultIcon}
								{state.status === "running" ? t("running") : t("run")}
							</Button>
						</Inline>
					</Stack>
				)}
				{state.status === "error" && <ErrorNoticeView notice={state.error} />}
				{state.status === "done" && <SlotResult state={state} onApply={apply} />}
			</Stack>
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
		if (result.items.length === 0)
			return (
				<Text as="p" tone="muted">
					{t("noResults")}
				</Text>
			);
		return (
			<Inline as="ul" wrap gap={12}>
				{result.items.map((item) => (
					<Box as="li" key={item.value} maxWidth="full">
						<TextButton onClick={() => onApply(item.value)} title={item.label}>
							{item.label}
							{item.detail && (
								<Text as="span" tone="subtle" variant="caption">
									{" "}
									{item.detail}
								</Text>
							)}
						</TextButton>
					</Box>
				))}
			</Inline>
		);
	}
	return (
		<Stack gap={8}>
			<Box padding={8} radius="lg" border="all" background="page">
				<Text as="p" variant="caption" tone="default">
					{result.text}
				</Text>
			</Box>
			{result.kind === "text" && action.apply !== "none" && (
				<Inline justify="start">
					<Button type="button" size="sm" variant="secondary" onClick={() => onApply(result.text)}>
						{action.apply === "append" ? t("insert") : t("replace")}
					</Button>
				</Inline>
			)}
		</Stack>
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

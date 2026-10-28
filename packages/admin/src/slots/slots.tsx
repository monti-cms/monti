"use client";

import { AiAction, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@monti-cms/ui";
import type { ReactNode } from "react";
import { ErrorNoticeView } from "../ui/error-notice";
import type { SlotRequest } from "./registry";
import { useSlotActions } from "./use-slot-actions";

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
 * this file draws the fill action on top of `useSlotActions`.
 */

/**
 * The fill action (`trigger`) and the line a failed run leaves (`panel`) of one slot. The action is the text button of the label row: "Fill" while
 * the target is empty, "↻ Again" once it has a value (`request.filled`), a spinner and "Writing…" while it works. Pressing it runs the action and puts
 * the result in at once. With more than one action attached it opens a list of them. Both are `null` when no action is attached.
 */
export function useSlot(request: SlotRequest): { trigger: ReactNode; panel: ReactNode } {
	const { actions, state, run } = useSlotActions(request);
	if (actions.length === 0) return { trigger: null, panel: null };

	const busy = state.status === "running";
	const first = actions[0];
	const trigger =
		actions.length === 1 ? (
			<AiAction
				filled={request.filled}
				loading={busy}
				disabled={request.disabled}
				title={first?.label}
				onClick={() => first && void run(first.id)}
			/>
		) : (
			<DropdownMenu>
				<DropdownMenuTrigger
					render={<AiAction filled={request.filled} loading={busy} disabled={request.disabled} title={first?.label} />}
				/>
				<DropdownMenuContent align="end">
					{actions.map((action) => (
						<DropdownMenuItem key={action.id} onClick={() => void run(action.id)}>
							{action.label}
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
		);

	const panel = state.status === "error" ? <ErrorNoticeView notice={state.error} /> : null;
	return { trigger, panel };
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

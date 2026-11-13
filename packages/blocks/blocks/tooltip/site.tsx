import type { MarkProps } from "@monti-cms/core/render";
import type { ReactNode } from "react";
import { style } from "./style";
import { Tooltip } from "./tooltip.client";

/** Words with a note (`:tooltip[words]{text="…"}`): the note shows when a reader points at the words or reaches them by keyboard, or taps them. */
function TooltipMarkDrawing({ mark, children }: MarkProps & { children?: ReactNode }) {
	return <Tooltip content={typeof mark.text === "string" ? mark.text : ""}>{children}</Tooltip>;
}

/** TooltipMark with its look (`style.ts`): React puts it into the page once, however many of the block there are. */
export function TooltipMark(props: Parameters<typeof TooltipMarkDrawing>[0]) {
	return (
		<>
			<style href="monti-block-tooltip" precedence="monti-blocks">
				{style}
			</style>
			<TooltipMarkDrawing {...props} />
		</>
	);
}

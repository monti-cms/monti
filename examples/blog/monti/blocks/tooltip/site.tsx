import type { MarkProps } from "@monti-cms/core/render";
import type { ReactNode } from "react";
import { Tooltip } from "./tooltip.client";

/** Words with a note (`:tooltip[words]{text="…"}`): the note shows when a reader points at the words or reaches them by keyboard, or taps them. */
export function TooltipMark({ mark, children }: MarkProps & { children?: ReactNode }) {
	return <Tooltip content={typeof mark.text === "string" ? mark.text : ""}>{children}</Tooltip>;
}

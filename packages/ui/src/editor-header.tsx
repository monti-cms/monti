import * as React from "react";
import { useAssistantSlot } from "./assistant-slot";
import { dockTop } from "./bottom-dock";
import { cn } from "./cn";

/**
 * The head of an editor: the way back, where the entry lives and its state at the start; saving, publishing and the editor's tools at the end. As tall as
 * the sidebar's head, on the page ground with a line under it; on a narrow screen its two ends wrap. The assistant's ✦ ends the row (`AssistantSlot`), after
 * the editor's own tools.
 */
function EditorHeader({ className, children, ...props }: React.ComponentProps<"header">) {
	const assistant = useAssistantSlot();
	// Known to what opens in the body, which leaves the header clear (`usePlacementPadding`).
	const [node, setNode] = React.useState<HTMLElement | null>(null);
	React.useEffect(() => (node ? dockTop(node) : undefined), [node]);
	return (
		<header
			ref={setNode}
			data-slot="editor-header"
			className={cn(
				// The second group, or the ✦ when there is only the start, stands at the end.
				"flex min-h-monti-header shrink-0 flex-wrap items-center gap-monti-12 border-monti-default border-b bg-monti-page px-monti-12 [&>:nth-child(2)]:ml-auto",
				className,
			)}
			{...props}
		>
			{children}
			{assistant}
		</header>
	);
}

/** The ink rule under an entry's title, 20px below it, that sets the title apart from the body. */
function EditorTitleRule({ className, ...props }: Omit<React.ComponentProps<"div">, "children">) {
	return (
		<div
			data-slot="editor-title-rule"
			aria-hidden="true"
			className={cn("border-monti-contrast border-b pt-monti-20", className)}
			{...props}
		/>
	);
}

export { EditorHeader, EditorTitleRule };

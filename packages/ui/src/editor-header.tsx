import * as React from "react";
import { useAssistantSlot } from "./assistant-slot";
import { dockTop } from "./bottom-dock";
import { Button } from "./button";
import { cn } from "./cn";
import { CutWords } from "./cut-words";
import { IconButtonContext } from "./icon-button";
import { ChevronLeft } from "./icons";

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
				"flex min-h-monti-header shrink-0 flex-wrap items-center gap-monti-8 border-monti-default border-b bg-monti-page pr-monti-12 pl-monti-8 [&>:nth-child(2)]:ml-auto",
				className,
			)}
			{...props}
		>
			{children}
			{/* The ✦ stands 4px after the tools before it, as the tools stand from one another (2026-11 editor mockup `parts/topbar.html`). */}
			{assistant && (
				<span data-slot="editor-header-assistant" className="-ml-monti-4 flex">
					{/* 상자가 아니라 보이는 별의 끝이 머리 줄의 끝선(오른쪽 12px 안)에 선다(`IconButton edge="end"`). */}
					<IconButtonContext value={{ edge: "end" }}>{assistant}</IconButtonContext>
				</span>
			)}
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

/**
 * Where the entry lives, after the way back in the editor's head (2026-11 editor mockup): "/ folder / title" in 13px, 2px apart, the slashes in `fg-disabled` (only marks: they are not read), the folders subtle,
 * the entry's title in ink at 500, cut with "…" at 360px (a value, so it may be cut; it says itself whole when pointed at).
 */
function EditorPath({
	folders,
	title,
	className,
	...props
}: Omit<React.ComponentProps<"span">, "title"> & { folders: readonly React.ReactNode[]; title: React.ReactNode }) {
	const slash = (
		<span aria-hidden className="px-monti-4 text-monti-disabled">
			/
		</span>
	);
	return (
		<span
			data-slot="editor-path"
			className={cn("flex min-w-0 items-center gap-monti-2 text-monti-note text-monti-subtle", className)}
			{...props}
		>
			{folders.map((folder, index) => (
				// The folders of one path, in order: never moved.
				<React.Fragment key={index}>
					{slash}
					<span className="shrink-0 whitespace-nowrap">{folder}</span>
				</React.Fragment>
			))}
			{slash}
			<CutWords className="min-w-0 max-w-[360px] truncate font-medium text-monti-default">{title}</CutWords>
		</span>
	);
}

/**
 * The way back at the start of the editor's head (2026-11 editor mockup `parts/topbar.html`): a small ghost button, a ‹ and the list's name ("글"), 4px
 * inside before the chevron and 8px after the words, so the chevron stands 12px from the head's start.
 */
function EditorBackButton({
	className,
	children,
	...props
}: Omit<React.ComponentProps<typeof Button>, "variant" | "size">) {
	return (
		<Button variant="ghost" size="sm" className={cn("pr-monti-8 pl-monti-4", className)} {...props}>
			<ChevronLeft aria-hidden />
			{children}
		</Button>
	);
}

export { EditorBackButton, EditorHeader, EditorPath, EditorTitleRule };

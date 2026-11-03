import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";
import { OverflowMenuHorizontal } from "./icons";

/** The past conversations of the assistant panel: groups of {@link ConversationRow} by day under a {@link ConversationGroupLabel}. It scrolls. */
function ConversationList({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="conversation-list"
			className={cn("flex min-h-0 flex-1 flex-col gap-monti-2 overflow-auto p-monti-12", className)}
			{...props}
		/>
	);
}

/** The day of a group of past conversations ("Today", "Earlier"): mono 11 in the subtle gray, lined up with the rows' words. */
function ConversationGroupLabel({ className, ...props }: ComponentProps<"span">) {
	return (
		<span
			data-slot="conversation-group-label"
			className={cn(
				"px-monti-12 pt-monti-16 pb-monti-6 text-monti-micro text-monti-subtle first:pt-monti-4",
				className,
			)}
			{...props}
		/>
	);
}

/**
 * One past conversation: what was asked first (one line, cut), and under it in mono when it was and what came of it ("10:58 · First post · 5 accepted").
 * Pressing it opens the conversation. `current` marks the one open now. `menu` is its ⋯ button (a menu with Delete), at the top right; it shows while the
 * row is pointed at, focused or current, or while its menu is open.
 */
function ConversationRow({
	title,
	meta,
	current = false,
	menu,
	className,
	...props
}: Omit<ComponentProps<"button">, "type" | "title" | "children"> & {
	title: ReactNode;
	meta?: ReactNode;
	current?: boolean;
	menu?: ReactNode;
}) {
	return (
		<div
			data-slot="conversation-row"
			data-current={current || undefined}
			className={cn(
				"group/conv relative rounded-monti-lg hover:bg-monti-selected data-current:bg-monti-selected",
				className,
			)}
		>
			<button
				type="button"
				aria-current={current || undefined}
				className="flex w-full cursor-pointer flex-col gap-monti-2 rounded-monti-lg border-0 bg-transparent px-monti-12 py-monti-10 text-left outline-none focus-visible:ring-2 focus-visible:ring-monti-contrast/20"
				{...props}
			>
				<span className={cn("truncate text-monti-body text-monti-default", menu !== undefined && "pr-monti-24")}>
					{title}
				</span>
				{meta !== undefined && <span className="text-monti-meta text-monti-subtle">{meta}</span>}
			</button>
			{menu !== undefined && (
				<div className="absolute top-monti-10 right-monti-12 flex opacity-0 group-focus-within/conv:opacity-100 group-hover/conv:opacity-100 has-data-popup-open:opacity-100 group-data-current/conv:opacity-100">
					{menu}
				</div>
			)}
		</div>
	);
}

/** The ⋯ of a {@link ConversationRow}: a small muted mark that opens the row's menu. Give it the trigger's props (`render` of a menu trigger). */
function ConversationRowMore({
	className,
	...props
}: Omit<ComponentProps<"button">, "children"> & { "aria-label": string }) {
	return (
		<button
			type="button"
			className={cn(
				"flex cursor-pointer rounded-monti-sm border-0 bg-transparent p-0 text-monti-muted outline-none hover:text-monti-default focus-visible:ring-2 focus-visible:ring-monti-contrast/20",
				className,
			)}
			{...props}
		>
			<OverflowMenuHorizontal aria-hidden className="size-4" />
		</button>
	);
}

export { ConversationGroupLabel, ConversationList, ConversationRow, ConversationRowMore };

import type * as React from "react";
import { ChangeDot } from "./change-dot";
import { cn } from "./cn";
import { HELD } from "./sortable";

/**
 * The row of a navigation, the rail's (`SidebarMenuButton`) and a page's own ({@link NavLink}): a 36px pill (a one-line row on the page ground), the name 10px in, the open one on the current
 * ground and semibold. Pointing at a row gives it the selected ground, one step under the open one's current ground, on the rail and on paper alike.
 */
export const NAV_ROW =
	"flex h-monti-control-lg w-full min-w-0 items-center gap-monti-10 rounded-monti-full border-0 bg-transparent px-monti-10 text-left text-monti-body no-underline outline-none focus-visible:ring-3 focus-visible:ring-monti-contrast/20 disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45 aria-[current=page]:bg-monti-current aria-[current=page]:font-semibold aria-[current=page]:text-monti-default not-disabled:hover:bg-monti-selected data-active:bg-monti-current data-active:font-semibold";

/** The count or identifier at the end of a {@link NAV_ROW}: mono, small and quiet, in the flow of the row, so a long name is cut before it. */
export const NAV_ROW_END =
	"ml-auto shrink-0 select-none font-mono font-normal text-monti-meta tabular-nums text-monti-subtle";

/**
 * One link of a page's own navigation, such as the collections beside the settings editor: 36px, the name, and at the end the identifier (`note`, mono,
 * quiet). It is the rail's row ({@link NAV_ROW}) on paper: the open one is on the current ground and semibold, the others are muted, and pointing at one gives it the selected ground. `dot` is the name of
 * the change dot that follows the name when this link holds an unsaved change. With `handle` (a {@link DragHandle}) the link can be dragged: the handle
 * shows in the left margin while the pointer or the keyboard is on the link; `drag` carries the sortable's transform while it is moved.
 */
function NavLink({
	active = false,
	dot,
	note,
	handle,
	drag,
	onSelect,
	className,
	children,
	...props
}: Omit<React.ComponentProps<"div">, "children" | "onClick"> & {
	active?: boolean;
	/** The name of the change dot for screen readers; the dot shows only when it is given. */
	dot?: string;
	/** The identifier at the end of the link. */
	note?: React.ReactNode;
	handle?: React.ReactNode;
	/** While the link is dragged: where the drag has moved it (the sortable's transform and transition) and whether it is the link in hand. */
	drag?: { transform?: string; transition?: string; active?: boolean };
	/** Without it the entry is drawn and opens nothing (a screen spec's look, before its behavior is wired). */
	onSelect?: () => void;
	children: React.ReactNode;
}) {
	return (
		<div
			data-slot="nav-link"
			className={cn("group/nav relative", drag?.active && HELD, className)}
			style={drag ? { transform: drag.transform, transition: drag.transition } : undefined}
			{...props}
		>
			{handle && (
				<span className="absolute top-1/2 left-0.5 z-10 flex size-5 -translate-y-1/2 opacity-0 *:size-full focus-within:opacity-100 group-hover/nav:opacity-100">
					{handle}
				</span>
			)}
			<button
				type="button"
				aria-current={active ? "page" : undefined}
				onClick={onSelect}
				className={cn(NAV_ROW, "cursor-pointer text-monti-muted")}
			>
				<span className="min-w-0 truncate">{children}</span>
				{dot && <ChangeDot label={dot} className="-ml-monti-4" />}
				{note && <span className={NAV_ROW_END}>{note}</span>}
			</button>
		</div>
	);
}

export { NavLink };

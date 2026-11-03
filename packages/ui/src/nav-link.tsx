import type * as React from "react";
import { ChangeDot } from "./change-dot";
import { cn } from "./cn";

/**
 * One link of a page's own navigation, such as the collections beside the settings editor: 36px, the name, and at the end the identifier (`note`, mono,
 * quiet). The open one is on the current ground and semibold; the others are muted, and pointing at one gives it the selected ground. `dot` is the name of
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
	onSelect: () => void;
	children: React.ReactNode;
}) {
	return (
		<div
			data-slot="nav-link"
			className={cn("group/nav relative", drag?.active && "z-10 opacity-80", className)}
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
				className="flex h-9 w-full min-w-0 cursor-pointer items-center gap-monti-10 rounded-monti-md border-0 bg-transparent px-monti-10 text-left text-monti-body text-monti-muted outline-none hover:bg-monti-selected focus-visible:ring-3 focus-visible:ring-monti-contrast/20 aria-[current=page]:bg-monti-current aria-[current=page]:font-semibold aria-[current=page]:text-monti-default"
			>
				<span className="min-w-0 truncate">{children}</span>
				{dot && <ChangeDot label={dot} className="-ml-monti-4" />}
				{note && <span className="ml-auto shrink-0 font-normal text-monti-meta text-monti-subtle">{note}</span>}
			</button>
		</div>
	);
}

export { NavLink };

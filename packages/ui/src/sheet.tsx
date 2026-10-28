"use client";

import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { Close } from "@carbon/icons-react";
import type * as React from "react";
import { cn } from "./cn";
import { useModalFocus } from "./dialog";
import { IconButton } from "./icon-button";
import { useUiLabels } from "./labels";
import { PANEL_BODY, PANEL_FOOT, PANEL_HEAD, PANEL_TITLE } from "./side-panel-frame";

function Sheet({ ...props }: SheetPrimitive.Root.Props) {
	return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
	return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
	return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ ...props }: SheetPrimitive.Portal.Props) {
	return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
	return (
		<SheetPrimitive.Backdrop
			data-slot="sheet-overlay"
			className={cn(
				"fixed inset-0 z-50 bg-monti-backdrop transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0",
				className,
			)}
			{...props}
		/>
	);
}

/**
 * The sheet: where work with several inputs happens (add a field, review a save). It opens from the right over a dimmed page, 520px wide, on the
 * tool ground with a line down its left edge, square, with the sheet shadow. Put a `SheetHeader`, a `SheetBody` and a `SheetFooter` in it.
 */
function SheetContent({
	className,
	children,
	resizable,
	style,
	...props
}: SheetPrimitive.Popup.Props & {
	/**
	 * A sheet the writer can widen: its width (`--panel-width` in `style`) and the drag handle on its left edge, both from the app, which decides
	 * where the chosen width is remembered. Replaces the default width.
	 */
	resizable?: { style: React.CSSProperties; handle: React.ReactNode };
}) {
	// Focus starts in the first field, or on the sheet itself: never on the close button, whose tooltip and ring would show the moment it opens.
	const { popup, initialFocus } = useModalFocus();
	return (
		<SheetPortal>
			<SheetOverlay />
			<SheetPrimitive.Popup
				ref={popup}
				initialFocus={initialFocus}
				data-slot="sheet-content"
				className={cn(
					"fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-full flex-col border-monti-emphasis border-l bg-monti-tool text-monti-body text-monti-default shadow-monti-sheet outline-none transition duration-200 ease-in-out data-ending-style:translate-x-10 data-starting-style:translate-x-10 data-ending-style:opacity-0 data-starting-style:opacity-0",
					resizable ? "sm:w-(--panel-width)" : "sm:w-monti-sheet",
					className,
				)}
				style={resizable ? { ...resizable.style, ...style } : style}
				{...props}
			>
				{resizable?.handle}
				{children}
			</SheetPrimitive.Popup>
		</SheetPortal>
	);
}

/** The 60px head: the title at the start and the close button at the end. */
function SheetHeader({ className, children, ...props }: React.ComponentProps<"div">) {
	const labels = useUiLabels();
	return (
		<div data-slot="sheet-header" className={cn(PANEL_HEAD, className)} {...props}>
			{children}
			<IconButton
				label={labels.close}
				side="bottom"
				trigger={(button) => <SheetPrimitive.Close data-slot="sheet-close" render={button} />}
			>
				<Close aria-hidden />
			</IconButton>
		</div>
	);
}

/** What the sheet is for; it scrolls when it is longer than the sheet. */
function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div data-slot="sheet-body" className={cn(PANEL_BODY, "min-h-0 grow overflow-y-auto", className)} {...props} />
	);
}

/** Cancel (a text button) and the one pill, right-aligned, at the bottom of the sheet. */
function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
	return <div data-slot="sheet-footer" className={cn(PANEL_FOOT, "mt-auto", className)} {...props} />;
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
	return <SheetPrimitive.Title data-slot="sheet-title" className={cn(PANEL_TITLE, className)} {...props} />;
}

export { Sheet, SheetBody, SheetClose, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger };

"use client";

import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { Close } from "@carbon/icons-react";
import * as React from "react";
import { cn } from "./cn";
import { useModalFocus } from "./dialog";
import { IconButton } from "./icon-button";
import { useUiLabels } from "./labels";
import { PANEL_BODY, PANEL_FOOT, PANEL_HEAD, PANEL_TITLE } from "./side-panel";

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
 * The sheet: where work with several inputs happens (add a field, review a save, an import). It opens from the right over a dimmed page, 520px
 * wide, on the tool ground with a line down its left edge, square, with the sheet shadow. Its width is fixed. Put a `SheetHeader`, a `SheetBody` and a
 * `SheetFooter` in it.
 */
function SheetContent({ className, children, ...props }: SheetPrimitive.Popup.Props) {
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
					"sm:w-monti-sheet",
					className,
				)}
				{...props}
			>
				{children}
			</SheetPrimitive.Popup>
		</SheetPortal>
	);
}

/**
 * The 60px head: the title at the start and the close button at the end. It has no ✦ place: the sheet covers that button while it is open. With
 * `closable={false}` (the sheet is busy and cannot be left) there is no close button.
 */
function SheetHeader({
	className,
	children,
	closable = true,
	...props
}: React.ComponentProps<"div"> & { closable?: boolean }) {
	const labels = useUiLabels();
	return (
		<div data-slot="sheet-header" className={cn(PANEL_HEAD, className)} {...props}>
			{children}
			{closable && (
				<IconButton
					label={labels.close}
					side="bottom"
					trigger={(button) => <SheetPrimitive.Close data-slot="sheet-close" render={button} />}
				>
					<Close aria-hidden />
				</IconButton>
			)}
		</div>
	);
}

/** What the sheet is for; it scrolls when it is longer than the sheet. */
function SheetBody({
	className,
	blocks = false,
	...props
}: React.ComponentProps<"div"> & {
	/** The body is a run of change blocks, which bring their own 16px above: only 4px of the body's 20 stay over the first. */
	blocks?: boolean;
}) {
	return (
		<div
			data-slot="sheet-body"
			className={cn(PANEL_BODY, "min-h-0 grow overflow-y-auto", blocks && "pt-monti-4", className)}
			{...props}
		/>
	);
}

/**
 * A sheet body split in two: `list` on the left (150px, a rule down its right edge), the work on the right. The kinds of a new field are the list and the
 * settings of the picked kind are the work. Put a `SheetBody` in the right side so it scrolls under its own tabs.
 */
function SheetSplit({
	list,
	className,
	children,
	...props
}: Omit<React.ComponentProps<"div">, "children"> & { list: React.ReactNode; children: React.ReactNode }) {
	return (
		<div data-slot="sheet-split" className={cn("flex min-h-0 grow", className)} {...props}>
			<div
				data-slot="sheet-split-list"
				className="flex shrink-0 basis-[150px] flex-col border-monti-muted border-r py-monti-16 pr-monti-16 pl-monti-24"
			>
				{list}
			</div>
			<div className="flex min-h-0 min-w-0 grow flex-col">{children}</div>
		</div>
	);
}

/**
 * A titled part of a sheet's body, like View and Structure in the editor of a field: the title in 14px semibold and the fields under it. A later section starts
 * 8px lower. The title may end in a {@link LockMark} when the whole section cannot be changed.
 */
function SheetSection({
	title,
	className,
	children,
	...props
}: Omit<React.ComponentProps<"section">, "title" | "aria-labelledby"> & { title: React.ReactNode }) {
	const titleId = React.useId();
	return (
		<section
			data-slot="sheet-section"
			aria-labelledby={titleId}
			className={cn("not-first:mt-monti-8 flex flex-col gap-[18px]", className)}
			{...props}
		>
			<h2 id={titleId} className="m-0 font-semibold text-monti-body">
				{title}
			</h2>
			{children}
		</section>
	);
}

/** Cancel (a text button) and the one pill, right-aligned, at the bottom of the sheet. */
function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
	return <div data-slot="sheet-footer" className={cn(PANEL_FOOT, "mt-auto", className)} {...props} />;
}

/**
 * The title; `of` is what the sheet is about when the title alone does not say (a file name), after it, in mono and quiet, on the same line. With
 * `ofMono={false}` it is plain text, for a name and a count ("Review · Posts · 3 changes").
 */
function SheetTitle({
	className,
	children,
	of,
	ofMono = true,
	...props
}: SheetPrimitive.Title.Props & { of?: React.ReactNode; ofMono?: boolean }) {
	return (
		<SheetPrimitive.Title data-slot="sheet-title" className={cn(PANEL_TITLE, className)} {...props}>
			{children}
			{of && (
				<span className={cn("ml-monti-4 font-normal text-monti-meta text-monti-subtle", ofMono && "font-mono")}>
					{of}
				</span>
			)}
		</SheetPrimitive.Title>
	);
}

export {
	Sheet,
	SheetBody,
	SheetClose,
	SheetContent,
	SheetFooter,
	SheetHeader,
	SheetSection,
	SheetSplit,
	SheetTitle,
	SheetTrigger,
};

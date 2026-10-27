"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import * as React from "react";
import { cn } from "./cn";
import { useUiLabels } from "./labels";
import { TextButton } from "./text-button";

/**
 * The look of a modal, shared by `Dialog` and `AlertDialog`: the page ground with an emphasis edge, the largest radius and the overlay shadow, 28px
 * around (22 below), 420px wide. The title is 20px with an ink rule under it, the text below it 16px lower, and the actions a row at the bottom right.
 */
export const DIALOG_SURFACE =
	"data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 fixed top-1/2 left-1/2 z-50 flex w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-monti-24 rounded-monti-xl border border-monti-emphasis bg-monti-page px-[28px] pt-[28px] pb-[22px] text-monti-body text-monti-default shadow-monti-overlay outline-none duration-100 data-closed:animate-out data-open:animate-in sm:max-w-[420px]";

/** What sits behind a modal: the backdrop color alone, no blur. */
export const DIALOG_BACKDROP =
	"data-open:fade-in-0 data-closed:fade-out-0 fixed inset-0 isolate z-50 bg-monti-backdrop duration-100 data-closed:animate-out data-open:animate-in";

/** The title and the text under it. */
export const DIALOG_HEADER = "flex flex-col gap-monti-16";
export const DIALOG_TITLE =
	"border-monti-contrast border-b pb-[14px] font-bold text-[20px] leading-[28px] tracking-[-0.015em] text-monti-default";
export const DIALOG_DESCRIPTION =
	"text-monti-body text-monti-muted leading-[1.65] *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-monti-default";

/** Cancel (a text button) and the one pill, right-aligned, 18px apart. */
export const DIALOG_ACTIONS = "flex flex-wrap items-center justify-end gap-[18px]";

/**
 * Where focus lands when a modal opens: the first text field if there is one, else the modal itself, so no button shows a focus ring the moment it
 * appears. A focus ring is for the keyboard moving on from there.
 */
export function useModalFocus() {
	const popup = React.useRef<HTMLDivElement>(null);
	const initialFocus = React.useCallback(
		() => popup.current?.querySelector<HTMLElement>("input:not([type=hidden]), textarea, select") ?? popup.current,
		[],
	);
	return { popup, initialFocus };
}

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
	return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
	return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
	return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
	return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
	return <DialogPrimitive.Backdrop data-slot="dialog-overlay" className={cn(DIALOG_BACKDROP, className)} {...props} />;
}

const DIALOG_WIDTH = { default: "", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" } as const;

function DialogContent({
	className,
	children,
	size = "default",
	scroll = false,
	...props
}: DialogPrimitive.Popup.Props & {
	/** Width on a wide screen: 420px by default (a question, a short form); `lg` for a form with a preview, `xl` for a review of many changes. */
	size?: keyof typeof DIALOG_WIDTH;
	/** Scrolls inside, up to 85% of the window's height (a long review or preview). */
	scroll?: boolean;
}) {
	const { popup, initialFocus } = useModalFocus();
	return (
		<DialogPortal>
			<DialogOverlay />
			<DialogPrimitive.Popup
				ref={popup}
				initialFocus={initialFocus}
				data-slot="dialog-content"
				className={cn(
					DIALOG_SURFACE,
					DIALOG_WIDTH[size],
					scroll && "max-h-[85vh] overflow-y-auto *:shrink-0",
					className,
				)}
				{...props}
			>
				{children}
			</DialogPrimitive.Popup>
		</DialogPortal>
	);
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
	return <div data-slot="dialog-header" className={cn(DIALOG_HEADER, className)} {...props} />;
}

function DialogFooter({
	className,
	showCloseButton = false,
	children,
	...props
}: React.ComponentProps<"div"> & {
	/** A text button that only closes the dialog, before the rest. */
	showCloseButton?: boolean;
}) {
	const labels = useUiLabels();
	return (
		<div data-slot="dialog-footer" className={cn(DIALOG_ACTIONS, className)} {...props}>
			{showCloseButton && <DialogPrimitive.Close render={<TextButton />}>{labels.cancel}</DialogPrimitive.Close>}
			{children}
		</div>
	);
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
	return <DialogPrimitive.Title data-slot="dialog-title" className={cn(DIALOG_TITLE, className)} {...props} />;
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
	return (
		<DialogPrimitive.Description
			data-slot="dialog-description"
			className={cn(DIALOG_DESCRIPTION, className)}
			{...props}
		/>
	);
}

export {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogOverlay,
	DialogPortal,
	DialogTitle,
	DialogTrigger,
};

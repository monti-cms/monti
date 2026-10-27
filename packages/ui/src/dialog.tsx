"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "./cn";
import { IconButton } from "./icon-button";
import { useUiLabels } from "./labels";
import { TextButton } from "./text-button";

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
	return (
		<DialogPrimitive.Backdrop
			data-slot="dialog-overlay"
			className={cn(
				"data-open:fade-in-0 data-closed:fade-out-0 fixed inset-0 isolate z-50 bg-monti-backdrop duration-100 data-closed:animate-out data-open:animate-in supports-backdrop-filter:backdrop-blur-xs",
				className,
			)}
			{...props}
		/>
	);
}

const DIALOG_WIDTH = { sm: "sm:max-w-sm", md: "sm:max-w-md", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" } as const;

function DialogContent({
	className,
	children,
	showCloseButton = true,
	size = "md",
	scroll = false,
	...props
}: DialogPrimitive.Popup.Props & {
	showCloseButton?: boolean;
	/** Width on a wide screen: `sm` a question, `md` a short form (default), `lg` a form with a preview, `xl` a review of many changes. */
	size?: keyof typeof DIALOG_WIDTH;
	/** Scrolls inside, up to 85% of the window's height (a long review or preview). */
	scroll?: boolean;
}) {
	const labels = useUiLabels();
	return (
		<DialogPortal>
			<DialogOverlay />
			<DialogPrimitive.Popup
				data-slot="dialog-content"
				className={cn(
					"data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-6 rounded-monti-xl border border-monti-muted bg-monti-page p-6 text-monti-body text-monti-default shadow-monti-floating outline-none duration-100 data-closed:animate-out data-open:animate-in",
					DIALOG_WIDTH[size],
					scroll && "max-h-[85vh] overflow-y-auto",
					className,
				)}
				{...props}
			>
				{children}
				{showCloseButton && (
					<IconButton
						label={labels.close}
						className="absolute top-4 right-4"
						trigger={(button) => <DialogPrimitive.Close data-slot="dialog-close" render={button} />}
					>
						<XIcon />
					</IconButton>
				)}
			</DialogPrimitive.Popup>
		</DialogPortal>
	);
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
	return <div data-slot="dialog-header" className={cn("flex flex-col gap-2", className)} {...props} />;
}

function DialogFooter({
	className,
	showCloseButton = false,
	children,
	...props
}: React.ComponentProps<"div"> & {
	showCloseButton?: boolean;
}) {
	const labels = useUiLabels();
	return (
		<div
			data-slot="dialog-footer"
			className={cn("flex flex-col-reverse gap-monti-16 sm:flex-row sm:items-center sm:justify-end", className)}
			{...props}
		>
			{children}
			{showCloseButton && <DialogPrimitive.Close render={<TextButton />}>{labels.close}</DialogPrimitive.Close>}
		</div>
	);
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
	return <DialogPrimitive.Title data-slot="dialog-title" className={cn("text-monti-title", className)} {...props} />;
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
	return (
		<DialogPrimitive.Description
			data-slot="dialog-description"
			className={cn(
				"text-monti-body text-monti-muted *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-monti-default",
				className,
			)}
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

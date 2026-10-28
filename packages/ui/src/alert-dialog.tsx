"use client";

import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import type * as React from "react";
import { Button } from "./button";
import { cn } from "./cn";
import {
	DIALOG_ACTIONS,
	DIALOG_BACKDROP,
	DIALOG_DESCRIPTION,
	DIALOG_HEADER,
	DIALOG_SURFACE,
	DIALOG_TITLE,
	useModalFocus,
} from "./dialog";
import { TextButton } from "./text-button";

function AlertDialog({ ...props }: AlertDialogPrimitive.Root.Props) {
	return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />;
}

function AlertDialogTrigger({ ...props }: AlertDialogPrimitive.Trigger.Props) {
	return <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />;
}

function AlertDialogPortal({ ...props }: AlertDialogPrimitive.Portal.Props) {
	return <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />;
}

function AlertDialogOverlay({ className, ...props }: AlertDialogPrimitive.Backdrop.Props) {
	return (
		<AlertDialogPrimitive.Backdrop
			data-slot="alert-dialog-overlay"
			className={cn(DIALOG_BACKDROP, className)}
			{...props}
		/>
	);
}

/** The same modal as `Dialog`: a question that must be answered before anything else, closed only by its own buttons or Escape. */
function AlertDialogContent({ className, ...props }: AlertDialogPrimitive.Popup.Props) {
	const { popup, initialFocus } = useModalFocus();
	return (
		<AlertDialogPortal>
			<AlertDialogOverlay />
			<AlertDialogPrimitive.Popup
				ref={popup}
				initialFocus={initialFocus}
				data-slot="alert-dialog-content"
				className={cn(DIALOG_SURFACE, className)}
				{...props}
			/>
		</AlertDialogPortal>
	);
}

function AlertDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
	return <div data-slot="alert-dialog-header" className={cn(DIALOG_HEADER, className)} {...props} />;
}

function AlertDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
	return <div data-slot="alert-dialog-footer" className={cn(DIALOG_ACTIONS, className)} {...props} />;
}

function AlertDialogTitle({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
	return (
		<AlertDialogPrimitive.Title data-slot="alert-dialog-title" className={cn(DIALOG_TITLE, className)} {...props} />
	);
}

function AlertDialogDescription({
	className,
	...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
	return (
		<AlertDialogPrimitive.Description
			data-slot="alert-dialog-description"
			className={cn(DIALOG_DESCRIPTION, className)}
			{...props}
		/>
	);
}

function AlertDialogAction({ className, ...props }: React.ComponentProps<typeof Button>) {
	return <Button data-slot="alert-dialog-action" className={cn(className)} {...props} />;
}

function AlertDialogCancel({ className, ...props }: AlertDialogPrimitive.Close.Props) {
	return (
		<AlertDialogPrimitive.Close
			data-slot="alert-dialog-cancel"
			className={cn(className)}
			render={<TextButton />}
			{...props}
		/>
	);
}

export {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogOverlay,
	AlertDialogPortal,
	AlertDialogTitle,
	AlertDialogTrigger,
};

"use client";

import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import type * as React from "react";
import { Button } from "./button";
import { cn } from "./cn";
import {
	BACKDROP,
	DIALOG_ACTIONS,
	DIALOG_DESCRIPTION,
	DIALOG_HEADER,
	DIALOG_SURFACE,
	DIALOG_TITLE,
	modalSurface,
	useModalFocus,
} from "./dialog";

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
		<AlertDialogPrimitive.Backdrop data-slot="alert-dialog-overlay" className={cn(BACKDROP, className)} {...props} />
	);
}

/** `wide` (520px) is for a question that lists what it touches, with a choice per line (the review of a permanent delete), and for one with three answers (leaving with "save and leave"). */
const ALERT_WIDTH = { default: "", wide: "sm:max-w-[520px]" } as const;

/**
 * The same modal as `Dialog`: a question that must be answered before anything else, closed only by its own buttons or Escape. Once answered it
 * takes no second press while it fades (`modalSurface`).
 */
function AlertDialogContent({
	className,
	size = "default",
	...props
}: AlertDialogPrimitive.Popup.Props & { size?: keyof typeof ALERT_WIDTH }) {
	const { popup, initialFocus } = useModalFocus();
	return (
		<AlertDialogPortal>
			<AlertDialogOverlay />
			<AlertDialogPrimitive.Popup
				ref={popup}
				initialFocus={initialFocus}
				render={modalSurface}
				data-slot="alert-dialog-content"
				data-shape="square"
				className={cn(DIALOG_SURFACE, ALERT_WIDTH[size], className)}
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

/** The text button that answers a question without doing the thing: "Cancel". `variant="danger"` is for the risky way out of a question whose main button keeps things as they are ("Leave without saving"). */
function AlertDialogCancel({
	className,
	variant = "plain",
	...props
}: AlertDialogPrimitive.Close.Props & { variant?: "plain" | "danger" }) {
	return (
		<AlertDialogPrimitive.Close
			data-slot="alert-dialog-cancel"
			className={cn(className)}
			render={<Button variant={variant === "danger" ? "ghost-danger" : "ghost"} />}
			{...props}
		/>
	);
}

/**
 * 묻는 일이 무엇을 건드리는지 한 줄씩 적는 상자(시안 `settings-lang-source.html`의 원문 바꾸기): 설명 아래, 도구 바탕, `radius-md`, 안쪽 위아래 12px ·
 * 양옆 14px, 줄 사이 8px, 13px `fg-muted`. 줄은 {@link AlertDialogEffect}다.
 */
function AlertDialogEffects({ className, ...props }: React.ComponentProps<"ul">) {
	return (
		<ul
			data-slot="alert-dialog-effects"
			className={cn(
				"m-0 flex list-none flex-col gap-monti-8 rounded-monti-md bg-monti-tool px-[14px] py-monti-12 text-monti-label text-monti-muted",
				className,
			)}
			{...props}
		/>
	);
}

/** 건드리는 것 한 줄: 앞에 16px 흐린 아이콘(첫 줄 가운데), 8px 뒤에 문장. 꼭 알아야 할 말은 문장 안에서 먹색 600으로 둔다. */
function AlertDialogEffect({
	icon,
	className,
	children,
	...props
}: React.ComponentProps<"li"> & { icon: React.ReactNode }) {
	return (
		<li data-slot="alert-dialog-effect" className={cn("flex items-start gap-monti-8", className)} {...props}>
			<span className="flex h-[18px] shrink-0 items-center text-monti-faint [&_svg]:size-4">{icon}</span>
			<span className="min-w-0">{children}</span>
		</li>
	);
}

export {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogEffect,
	AlertDialogEffects,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogOverlay,
	AlertDialogPortal,
	AlertDialogTitle,
	AlertDialogTrigger,
};

"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import * as React from "react";
import { Button } from "./button";
import { cn } from "./cn";
import { CutWords } from "./cut-words";
import { letHeldKeyGo } from "./held-key";
import { useUiLabels } from "./labels";

/**
 * The look of a modal, shared by `Dialog` and `AlertDialog`: the page ground with an emphasis edge, the largest radius and the overlay shadow, 28px
 * around (22 below), 420px wide. The title is 20px with an ink rule under it, the text below it 16px lower, and the actions a row at the bottom right.
 */
export const DIALOG_SURFACE =
	"data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 fixed top-1/2 left-1/2 z-50 flex w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-monti-24 rounded-monti-xl border border-monti-emphasis bg-monti-page px-monti-24 pt-monti-24 pb-monti-20 text-monti-body text-monti-default shadow-monti-overlay outline-none duration-(--monti-duration-fast) data-closed:animate-out data-open:animate-in sm:max-w-[420px]";

/** What sits behind a modal, a sheet or the narrow-screen sidebar: the backdrop color alone, no blur, fading in and out over 150ms. */
export const BACKDROP =
	"fixed inset-0 isolate z-50 bg-monti-backdrop transition-opacity duration-(--monti-duration-normal) data-ending-style:opacity-0 data-starting-style:opacity-0";

/** The title and the text under it. */
export const DIALOG_HEADER = "flex flex-col gap-monti-16";
export const DIALOG_TITLE = "border-monti-contrast border-b pb-monti-12 text-monti-heading text-monti-default";
export const DIALOG_DESCRIPTION =
	"text-monti-prose text-monti-muted *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-monti-default";

/** Cancel (a text button) and the one pill, right-aligned, 18px apart. */
export const DIALOG_ACTIONS = "flex flex-wrap items-center justify-end gap-monti-16";

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

/**
 * The box of a modal or a sheet, which takes nothing once it has been told to close: it stays in the page while it fades, and a second press in
 * that time (a pointer on its button, Enter in its field, its form sent) would do the thing again. While it closes it is `inert`: no press, no
 * key and no focus reach it. A key still held when it is told to close does nothing more either ({@link letHeldKeyGo}): its repeats would
 * press whatever the focus goes back to.
 */
function ModalSurface({ closing, onKeyDown, ...props }: React.ComponentProps<"div"> & { closing: boolean }) {
	React.useLayoutEffect(() => {
		if (closing) letHeldKeyGo();
	}, [closing]);
	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: the popup's role comes with its props (dialog, alertdialog).
		<div
			{...props}
			inert={closing}
			onKeyDown={(event) => {
				onKeyDown?.(event);
				keepTabInside(event);
			}}
		/>
	);
}

/** What the Tab key can stop on, by what it is; whether it does is asked of each (`stopsTab`). */
const TAB_STOPS = 'a[href], button, input, select, textarea, [contenteditable="true"], [tabindex]';
const stopsTab = (element: HTMLElement) => {
	const order = element.getAttribute("tabindex");
	if (order !== null && Number(order) < 0) return false;
	if (element.matches(':disabled, input[type="hidden"]') || element.closest("[inert]")) return false;
	return element.getClientRects().length > 0 && getComputedStyle(element).visibility === "visible";
};

/**
 * Tab at a modal's last stop goes to its first, and Shift+Tab at its first (or on the modal itself, where focus lands when it opens) to its
 * last, in the same press. The primitive does this a frame later, from a stop of its own beside the box: a second Tab inside that frame
 * (a held or a quick key) went on from there into the page behind, whose controls are hidden from a screen reader but not from the keyboard,
 * and Enter pressed them under the question. Focus in something the modal opened elsewhere in the page (a menu of its own) is left alone.
 */
function keepTabInside(event: React.KeyboardEvent<HTMLDivElement>) {
	if (event.key !== "Tab" || event.defaultPrevented) return;
	const box = event.currentTarget;
	const on = document.activeElement;
	if (on !== box && !box.contains(on)) return;
	const stops = [...box.querySelectorAll<HTMLElement>(TAB_STOPS)].filter(stopsTab);
	const first = stops[0];
	const last = stops.at(-1);
	// Nothing to stop on: the focus stays on the modal.
	if (!first || !last) return void event.preventDefault();
	if (event.shiftKey ? on === first || on === box : on === last) {
		event.preventDefault();
		(event.shiftKey ? last : first).focus();
	}
}

/** The `render` of every modal's and sheet's popup: {@link ModalSurface}, closing when the popup is no longer open. */
export const modalSurface = (props: React.ComponentProps<"div">, state: { open: boolean }) => (
	<ModalSurface {...props} closing={!state.open} />
);

/** Whether the window may not be left now: set by what is inside it (`DialogFormFooter` with `lockWhileBusy`, while its request runs). */
const DialogLock = React.createContext<React.RefObject<boolean> | null>(null);

/**
 * Keeps the window it is in from being left while `locked`: not by Escape, not by a press outside, not by a close button. The window's owner
 * can still close it (the request came back). Outside a `Dialog` it does nothing.
 */
export function useDialogLock(locked: boolean) {
	const lock = React.useContext(DialogLock);
	React.useLayoutEffect(() => {
		if (!lock) return;
		lock.current = locked;
		return () => {
			lock.current = false;
		};
	}, [lock, locked]);
}

function Dialog({ onOpenChange, ...props }: DialogPrimitive.Root.Props) {
	const lock = React.useRef(false);
	return (
		<DialogLock value={lock}>
			<DialogPrimitive.Root
				data-slot="dialog"
				onOpenChange={(open, details) => {
					// Locked from inside: the person's ways out do nothing, as if not pressed.
					if (!open && lock.current) return details.cancel();
					onOpenChange?.(open, details);
				}}
				{...props}
			/>
		</DialogLock>
	);
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
	return <DialogPrimitive.Backdrop data-slot="dialog-overlay" className={cn(BACKDROP, className)} {...props} />;
}

const DIALOG_WIDTH = { default: "", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" } as const;

function DialogContent({
	className,
	children,
	size = "default",
	scroll = false,
	form = false,
	...props
}: DialogPrimitive.Popup.Props & {
	/** A dialog that holds fields: they sit 16px under the title (the text of a question sits there too), not the 24px between the other parts. */
	form?: boolean;
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
				render={modalSurface}
				data-slot="dialog-content"
				className={cn(
					DIALOG_SURFACE,
					DIALOG_WIDTH[size],
					scroll && "max-h-[85vh] overflow-y-auto *:shrink-0",
					form && "gap-monti-16",
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
			{showCloseButton && (
				<DialogPrimitive.Close render={<Button variant="ghost" />}>{labels.cancel}</DialogPrimitive.Close>
			)}
			{children}
		</div>
	);
}

/**
 * The title of the dialog. `of` is what it is about, after a dot in the regular weight and the subtle ink ("New language · tlh"). The title
 * is one line: its own words stay whole, and a long `of` (a name a person typed, with no place to break) is cut with "…" and says itself
 * whole when pointed at, as a table's cut cell does.
 */
function DialogTitle({ className, of, children, ...props }: DialogPrimitive.Title.Props & { of?: React.ReactNode }) {
	return (
		<DialogPrimitive.Title
			data-slot="dialog-title"
			className={cn(DIALOG_TITLE, of && "flex min-w-0 whitespace-pre", className)}
			{...props}
		>
			{/* Its own words give way only when they alone are wider than the window. */}
			{of ? <span className="max-w-full shrink-0 truncate">{children}</span> : children}
			{of && (
				<CutWords whole={typeof of === "string" ? of : undefined} className="font-normal text-monti-subtle">
					{" · "}
					{of}
				</CutWords>
			)}
		</DialogPrimitive.Title>
	);
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

"use client";

import { FolderInput } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { Toaster as Engine, toast as engine } from "sonner";
import { cn } from "./cn";

/** What a toast may carry besides its message. */
type ToastOptions = {
	/** One text button after the message (undo, view, open). Clicking it runs `onClick` and closes the toast. */
	action?: { label: string; onClick: () => void };
	/** Milliseconds before it closes by itself; `Infinity` keeps it until `toast.dismiss`. The `Toaster`'s `duration` by default (four seconds). */
	duration?: number;
	/** Showing a toast with the id of an open one replaces that one (an upload counting up, then done). */
	id?: string | number;
};

/** Every toast looks the same: an ink pill, one message, at most one action. An error is the same pill; only its wording tells. */
const PILL =
	"pointer-events-auto flex w-fit max-w-full items-center rounded-monti-lg bg-monti-emphasis px-monti-16 py-monti-10 text-monti-label font-normal text-monti-on-emphasis shadow-monti-floating";

/** The pill, centered in the width the engine gives a toast. */
function Frame({ className, children }: { className?: string; children: ReactNode }) {
	return (
		<div data-slot="toast" className="flex w-full justify-center">
			<div className={cn(PILL, className)}>{children}</div>
		</div>
	);
}

function show(message: ReactNode, { action, duration, id }: ToastOptions = {}): string | number {
	return engine.custom(
		(toastId) => (
			<Frame className="gap-monti-16 whitespace-pre-line">
				<span>{message}</span>
				{action && (
					<button
						type="button"
						data-slot="toast-action"
						className="shrink-0 cursor-pointer rounded-monti-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-monti-on-emphasis/50"
						onClick={() => {
							action.onClick();
							engine.dismiss(toastId);
						}}
					>
						{action.label}
					</button>
				)}
			</Frame>
		),
		{ id, duration },
	);
}

/**
 * The hint shown while files are dragged over a folder: an icon and a sentence, the folder's name in bold (`<b>`). It stays until `toast.dismiss(id)`.
 */
function dropHint(
	message: ReactNode,
	{
		icon = <FolderInput aria-hidden className="size-monti-icon-md shrink-0" />,
		id,
		duration = Number.POSITIVE_INFINITY,
	}: {
		icon?: ReactNode;
		id?: string | number;
		duration?: number;
	} = {},
): string | number {
	return engine.custom(
		() => (
			<Frame className="gap-monti-8">
				{icon}
				<span className="[&_b]:font-semibold">{message}</span>
			</Frame>
		),
		{ id, duration },
	);
}

/**
 * Shows a message at the bottom of the window. `toast("Moved to the trash", { action: { label: "Undo", onClick } })`. Returns the id, for `toast.dismiss(id)`
 * or to replace the message by showing another with that `id`.
 */
export const toast = Object.assign(show, { dropHint, dismiss: engine.dismiss });

/**
 * Mount once where the admin's pages are. The look is set by `toast`; this only places the stack, bottom center. `duration` is how long a toast stays
 * unless it says otherwise (four seconds; Storybook keeps them up).
 */
export function Toaster({ duration }: { duration?: number }) {
	return (
		<Engine
			position="bottom-center"
			duration={duration}
			// The engine gives a custom toast the width of its content, at the left of the stack: this puts the pill in the middle of it.
			toastOptions={{ classNames: { toast: "flex! w-full justify-center" } }}
			visibleToasts={3}
			style={{ "--width": "min(560px, calc(100vw - 32px))" } as CSSProperties}
		/>
	);
}

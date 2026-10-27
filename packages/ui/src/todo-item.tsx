import { Check } from "lucide-react";
import type * as React from "react";
import { cn } from "./cn";
import { useUiLabels } from "./labels";
import { Spark } from "./spark";

/**
 * One thing to fix, in the list a status bar cell opens: a ring, the title, one short line under it, and the one action that goes to it at the
 * right. `blocking` draws the ring in red for what stops publishing; the others are warning-colored. `marker` replaces the ring with a `Marker`
 * (a translated block whose source changed). `current` is the row whose place is open on the page. `proposal` puts a spark in front of the action and
 * makes it blue: the assistant does it. With `onOpen` the title and the line are a button that stretches over the row and goes to the place.
 */
function TodoItem({
	title,
	detail,
	blocking = false,
	marker,
	current = false,
	onOpen,
	actionLabel,
	onAction,
	proposal = false,
	className,
	...props
}: Omit<React.ComponentProps<"div">, "title"> & {
	title: React.ReactNode;
	/** One line under the title; a longer one is cut. */
	detail?: React.ReactNode;
	/** Stops publishing. */
	blocking?: boolean;
	/** A `Marker` in front of the title, instead of the ring. */
	marker?: React.ReactNode;
	current?: boolean;
	/** Goes to where the problem is. */
	onOpen?: () => void;
	actionLabel?: string;
	onAction?: () => void;
	/** The action is the assistant's. */
	proposal?: boolean;
}) {
	const labels = useUiLabels();
	const text = (
		<>
			<span>{title}</span>
			{detail && <span className="truncate text-monti-caption text-monti-subtle">{detail}</span>}
		</>
	);
	return (
		<div
			data-slot="todo-item"
			data-current={current || undefined}
			className={cn(
				"relative flex items-center gap-[10px] rounded-monti-md px-[9px] py-monti-8 text-monti-body text-monti-default data-current:bg-monti-selected",
				className,
			)}
			{...props}
		>
			{marker ? (
				<span data-slot="todo-mark" className="flex min-w-11 shrink-0 justify-center">
					{marker}
				</span>
			) : (
				<span
					aria-hidden={blocking ? undefined : true}
					data-slot="todo-mark"
					data-blocking={blocking || undefined}
					className={cn(
						"size-3.5 shrink-0 rounded-monti-full border-[1.5px] border-monti-warning",
						blocking && "border-monti-danger",
					)}
				>
					{/* The red ring is the only visible cue, so what it means is also said in words. */}
					{blocking && <span className="sr-only">{labels.blocking}</span>}
				</span>
			)}
			{onOpen ? (
				<button
					type="button"
					onClick={onOpen}
					className="flex min-w-0 grow cursor-pointer flex-col items-stretch gap-monti-2 border-0 bg-transparent p-0 text-left text-inherit outline-none after:absolute after:inset-0 after:rounded-monti-md focus-visible:after:ring-2 focus-visible:after:ring-monti-contrast/20"
				>
					{text}
				</button>
			) : (
				<span className="flex min-w-0 grow flex-col gap-monti-2">{text}</span>
			)}
			{actionLabel && (
				<button
					type="button"
					onClick={onAction}
					className={cn(
						"relative inline-flex shrink-0 cursor-pointer items-center gap-monti-4 border-0 bg-transparent p-0 text-monti-note outline-none focus-visible:rounded-monti-sm focus-visible:ring-2 focus-visible:ring-monti-contrast/20",
						proposal ? "text-monti-proposal" : "text-monti-muted",
					)}
				>
					{proposal && <Spark className="size-monti-icon-xs" />}
					{actionLabel}
				</button>
			)}
		</div>
	);
}

/** A thing that is already right: a green ✓ and one small line, under the rows to fix. */
function TodoDone({ className, children, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="todo-done"
			className={cn(
				"flex items-center gap-monti-8 px-[9px] pt-monti-6 pb-monti-4 text-monti-caption text-monti-subtle",
				className,
			)}
			{...props}
		>
			<Check aria-hidden className="size-3.5 shrink-0 text-monti-success" />
			{children}
		</div>
	);
}

export { TodoDone, TodoItem };

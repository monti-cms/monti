"use client";

import { type ComponentProps, type ReactNode, useId } from "react";
import { cn } from "./cn";
import { Label } from "./label";
import { useProposalDescription } from "./proposal-cue";
import { SidePanel } from "./side-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

/**
 * The properties pane of the editor: a tab bar at the top (no head and no close button), then a read list. It is a `SidePanel` 300px wide whose
 * pinned row is the tab bar. `children` is the list of the picked tab.
 */
function PropertyPanel({
	label,
	value,
	onValueChange,
	tabs,
	children,
}: {
	/** The pane's name. */
	label: string;
	/** The picked tab. */
	value: string;
	onValueChange: (value: string) => void;
	/** The tabs; `dot` marks a tab with something to handle. */
	tabs: readonly { value: string; label: string; dot?: "warning" | "proposal"; dotLabel?: string }[];
	children?: ReactNode;
}) {
	return (
		<Tabs fill className="h-full" value={value} onValueChange={(next) => onValueChange(String(next))}>
			<SidePanel
				width="panel"
				bleed
				aria-label={label}
				className="min-h-0 flex-1"
				bar={
					<TabsList variant="bar" aria-label={label}>
						{tabs.map((tab) => (
							<TabsTrigger key={tab.value} value={tab.value} dot={tab.dot} dotLabel={tab.dotLabel}>
								{tab.label}
							</TabsTrigger>
						))}
					</TabsList>
				}
			>
				<TabsContent value={value} className="px-monti-24 pt-monti-8 pb-monti-32">
					{children}
				</TabsContent>
			</SidePanel>
		</Tabs>
	);
}

/** A run of rows, with an optional quiet subheading above it ("Classification"). */
function PropertyGroup({
	title,
	className,
	children,
	...props
}: Omit<ComponentProps<"section">, "title"> & { title?: ReactNode }) {
	const titleId = useId();
	return (
		<section
			data-slot="property-group"
			aria-labelledby={title ? titleId : undefined}
			className={cn("flex flex-col", className)}
			{...props}
		>
			{title && (
				<h3 id={titleId} className="m-0 pt-monti-16 pb-monti-2 font-normal text-monti-micro text-monti-muted">
					{title}
				</h3>
			)}
			<dl className="m-0 flex flex-col">{children}</dl>
		</section>
	);
}

/**
 * One property: the label above (mono 11) with an `action` at the right end of the label row, the value below (13). At rest the value is text
 * with no box; with `onEdit` pressing it opens the field in place (`editing`, with the field as `children`). An empty value reads faint
 * (`empty`). `proposal` marks a value the assistant wrote and nobody has touched: blue, and described as the assistant's. The `action` shows only
 * while the pointer or the keyboard is in the row (and while it works).
 */
function PropertyRow({
	label,
	controlId,
	action,
	value,
	empty = false,
	proposal = false,
	onEdit,
	editing = false,
	error,
	errorId,
	note,
	children,
	className,
	...props
}: Omit<ComponentProps<"div">, "children" | "onChange"> & {
	label: ReactNode;
	/** The id of the field that opens in place: the label names it. */
	controlId?: string;
	/** What sits at the right end of the label row: the fill action, a count, a quiet text button. */
	action?: ReactNode;
	/** The value at rest. */
	value?: ReactNode;
	/** There is no value: `value` reads faint. */
	empty?: boolean;
	proposal?: boolean;
	/** Pressing the value opens it for editing. Absent: the value is only read (a locked or disabled property). */
	onEdit?: () => void;
	editing?: boolean;
	/** One line of error under the value. */
	error?: ReactNode;
	/** The id of the error line, for the field's `aria-describedby`. */
	errorId?: string;
	/** One quiet line under the value: why it cannot be changed here. */
	note?: ReactNode;
	/** The field, shown in place of the value while `editing`. */
	children?: ReactNode;
}) {
	const labelId = useId();
	const valueId = useId();
	const description = useProposalDescription(proposal);
	const tone = empty ? "text-monti-faint" : proposal ? "text-monti-proposal" : "text-monti-default";
	return (
		<div
			role="group"
			aria-labelledby={labelId}
			data-slot="property-row"
			className={cn(
				"group/row flex flex-col gap-monti-2 border-monti-muted border-b py-monti-10 last:border-b-0 **:data-[slot=ai-action]:data-loading:opacity-100 **:data-[slot=ai-action]:opacity-0 hover:**:data-[slot=ai-action]:opacity-100 focus-within:**:data-[slot=ai-action]:opacity-100",
				className,
			)}
			{...props}
		>
			<dt className="flex h-5 items-center justify-between gap-monti-12">
				<Label id={labelId} htmlFor={editing ? controlId : undefined} className="w-fit">
					{label}
				</Label>
				{action}
			</dt>
			<dd className="m-0 min-w-0 text-monti-note">
				{editing ? (
					children
				) : onEdit ? (
					<button
						type="button"
						id={valueId}
						aria-labelledby={`${labelId} ${valueId}`}
						aria-description={description}
						data-proposal={proposal || undefined}
						className={cn(
							"m-0 block w-full cursor-text whitespace-pre-wrap break-words border-0 bg-transparent p-0 text-left font-[inherit] text-[length:inherit] outline-none hover:underline hover:decoration-monti-default hover:underline-offset-4 focus-visible:rounded-monti-sm focus-visible:ring-2 focus-visible:ring-monti-contrast/20",
							tone,
						)}
						onClick={onEdit}
					>
						{value}
					</button>
				) : (
					<span
						id={valueId}
						aria-description={description}
						data-proposal={proposal || undefined}
						className={cn("block whitespace-pre-wrap break-words", tone)}
					>
						{value}
					</span>
				)}
				{note && <div className="mt-monti-2 text-monti-caption text-monti-muted">{note}</div>}
				{error && (
					<div id={errorId} role="alert" className="mt-monti-2 text-monti-danger text-monti-label">
						{error}
					</div>
				)}
			</dd>
		</div>
	);
}

export { PropertyGroup, PropertyPanel, PropertyRow };

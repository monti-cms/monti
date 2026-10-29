"use client";

import { useMemo } from "react";
import { ChangeDot } from "./change-dot";
import { cn } from "./cn";
import { Label } from "./label";
import { TextButton } from "./text-button";

function FormFieldSet({
	className,
	density = "default",
	...props
}: React.ComponentProps<"fieldset"> & {
	/** `compact` 16 between fields; `flush` none, for rows that carry their own spacing (the property pane's groups and rows). */
	density?: "default" | "compact" | "flush";
}) {
	return (
		<fieldset
			data-slot="field-set"
			className={cn(
				"flex min-w-0 flex-col has-[>[data-slot=checkbox-group]]:gap-monti-12 has-[>[data-slot=radio-group]]:gap-monti-12",
				density === "compact" ? "gap-monti-16" : density === "flush" ? "gap-0" : "gap-monti-24",
				className,
			)}
			{...props}
		/>
	);
}

function FormFieldLegend({
	className,
	variant = "legend",
	...props
}: React.ComponentProps<"legend"> & { variant?: "legend" | "label" | "field" }) {
	return (
		<legend
			data-slot="field-legend"
			data-variant={variant}
			className={cn(
				"mb-monti-12 data-[variant=field]:mb-monti-8 data-[variant=field]:text-monti-micro data-[variant=field]:text-monti-subtle data-[variant=label]:text-monti-label data-[variant=legend]:text-monti-title",
				className,
			)}
			{...props}
		/>
	);
}

function FormFieldGroup({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="field-group"
			className={cn(
				"group/field-group @container/field-group flex w-full flex-col gap-monti-24 data-[slot=checkbox-group]:gap-monti-12 *:data-[slot=field-group]:gap-monti-16",
				className,
			)}
			{...props}
		/>
	);
}

/**
 * A labeled field: the label above (mono 11), the control, then at most one line of error. The assistant's fill action sits on the label row
 * and shows only while the pointer or the keyboard is in this field.
 */
function FormField({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			role="group"
			data-slot="field"
			className={cn(
				"group/field flex w-full flex-col gap-monti-2 data-[invalid=true]:text-monti-danger **:data-[slot=ai-action]:opacity-0 hover:**:data-[slot=ai-action]:opacity-100 focus-within:**:data-[slot=ai-action]:opacity-100",
				className,
			)}
			{...props}
		/>
	);
}

/** What a label row says about a field that differs from the saved value: the dot's name, the undo button's text and what it puts back. */
export interface FormFieldChange {
	/** The dot's name for a screen reader ("changed"). */
	label: string;
	/** The undo button's text ("undo"). */
	undoLabel: string;
	/** The name the undo button is announced with, which starts with the field's name ("site name undo"). */
	undoName?: string;
	/** Puts the saved value back. Without it the row has the dot only (a switch, which is undone by turning it back). */
	onUndo?: () => void;
	/** The undo button cannot be pressed (the screen is read-only). */
	undoDisabled?: boolean;
}

/**
 * The label of a field. `changed` marks a field that differs from the saved value: a change dot after the label and a small quiet underlined undo button at the
 * end of the row. The row stays 14px high, the label's own height, so the field below does not move when it becomes changed.
 */
function FormFieldLabel({
	className,
	action,
	changed,
	...props
}: React.ComponentProps<typeof Label> & { action?: React.ReactNode; changed?: FormFieldChange }) {
	const label = (
		<Label
			data-slot="field-label"
			size="micro"
			tone="subtle"
			className={cn("peer/field-label w-fit group-data-[disabled=true]/field:opacity-45", className)}
			{...props}
		/>
	);
	if (changed) {
		return (
			<div data-slot="field-label-row" className="flex h-3.5 items-center gap-monti-8">
				{label}
				<ChangeDot label={changed.label} />
				{changed.onUndo && (
					<TextButton
						variant="underline"
						quiet
						size="caption"
						className="ml-auto"
						aria-label={changed.undoName}
						disabled={changed.undoDisabled}
						onClick={changed.onUndo}
					>
						{changed.undoLabel}
					</TextButton>
				)}
				{action}
			</div>
		);
	}
	if (!action) return label;
	return (
		<div className="flex items-baseline justify-between gap-monti-8">
			{label}
			{action}
		</div>
	);
}

function FormFieldTitle({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="field-label"
			className={cn(
				"flex w-fit items-center gap-monti-8 text-monti-label group-data-[disabled=true]/field:opacity-50",
				className,
			)}
			{...props}
		/>
	);
}

function FormFieldDescription({ className, ...props }: React.ComponentProps<"p">) {
	return (
		<p
			data-slot="field-description"
			className={cn(
				"text-left text-monti-label text-monti-muted [[data-variant=legend]+&]:-mt-monti-6",
				"nth-last-2:-mt-monti-4 last:mt-0",
				"[&>a]:text-monti-default [&>a]:underline [&>a]:underline-offset-4",
				className,
			)}
			{...props}
		/>
	);
}

function FormFieldError({
	className,
	children,
	errors,
	...props
}: React.ComponentProps<"div"> & {
	errors?: Array<{ message?: string } | undefined>;
}) {
	const content = useMemo(() => {
		if (children) {
			return children;
		}

		if (!errors?.length) {
			return null;
		}

		const uniqueErrors = [...new Map(errors.map((error) => [error?.message, error])).values()];

		if (uniqueErrors?.length == 1) {
			return uniqueErrors[0]?.message;
		}

		return (
			<ul className="ml-monti-16 list-disc">
				{uniqueErrors.map((error, index) => error?.message && <li key={index}>{error.message}</li>)}
			</ul>
		);
	}, [children, errors]);

	if (!content) {
		return null;
	}

	return (
		<div
			role="alert"
			data-slot="field-error"
			className={cn("whitespace-pre-wrap font-normal text-monti-danger text-monti-label", className)}
			{...props}
		>
			{content}
		</div>
	);
}

export {
	FormField,
	FormFieldLabel,
	FormFieldDescription,
	FormFieldError,
	FormFieldGroup,
	FormFieldLegend,
	FormFieldSet,
	FormFieldTitle,
};

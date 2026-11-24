"use client";

import { useMemo } from "react";
import { ChangeDot } from "./change-dot";
import { cn } from "./cn";
import { Label } from "./label";
import { Del } from "./proposal-marks";
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
				"mb-monti-12 data-[variant=field]:mb-monti-8 data-[variant=field]:text-monti-caption data-[variant=field]:text-monti-subtle data-[variant=label]:text-monti-label data-[variant=legend]:text-monti-title",
				className,
			)}
			{...props}
		/>
	);
}

/** Fields in a column, 24px apart; `density="compact"` puts them 16px apart (a group inside a group). The group spaces its own fields. */
function FormFieldGroup({
	className,
	density = "default",
	...props
}: React.ComponentProps<"div"> & { density?: "default" | "compact" }) {
	return (
		<div
			data-slot="field-group"
			data-density={density}
			className={cn(
				"group/field-group @container/field-group flex w-full flex-col",
				density === "compact" ? "gap-monti-16" : "gap-monti-24",
				className,
			)}
			{...props}
		/>
	);
}

/**
 * A labeled field: the label above (sans 12), the control, then at most one line of error. The assistant's fill action sits on the label row and
 * always shows (one hidden until the pointer came was not found, AS-27); while it works, `AiWorking` stands in its place.
 */
function FormField({
	spacing = "tight",
	className,
	...props
}: React.ComponentProps<"div"> & {
	/** `label`: 6px between the label, the control and its hint (the settings pages and the API key dialog of the 2026-11 redesign); `tight` (the default) 4px. */
	spacing?: "tight" | "label";
}) {
	return (
		<div
			role="group"
			data-slot="field"
			className={cn(
				"group/field flex w-full flex-col data-[invalid=true]:text-monti-danger",
				spacing === "label" ? "gap-monti-6" : "gap-monti-4",
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
	/** The undo button is drawn without `onUndo` (a screen spec's look, before its behavior is wired). */
	undoShown?: boolean;
	/** The undo button cannot be pressed (the screen is read-only). */
	undoDisabled?: boolean;
	/** `proposal`: the value is the assistant's and nobody has taken it yet; the dot is blue and the button discards it ("discard"). */
	tone?: "warning" | "proposal";
	/** A ref for the undo button, which goes away with the change it puts back: where a screen hands its keyboard focus on to the field. */
	undoRef?: React.Ref<HTMLButtonElement>;
}

/**
 * The label of a field. `changed` marks a field that differs from the saved value: a change dot after the label and a small quiet underlined undo button at the
 * end of the row. `action` goes at the end of the row too. The row stays one height whatever it holds, so the field below does not move when something comes or goes in it.
 */
function FormFieldLabel({
	className,
	action,
	changed,
	size = "caption",
	count,
	countTone,
	aside,
	children,
	...props
}: Omit<React.ComponentProps<typeof Label>, "size"> & {
	/** With `size="label"`: quiet words after the label, 4px off, 13px 400 in the faint ink ("· 선택" for a field that may stay empty, 시안 `keys7-add-fail.html`). */
	aside?: React.ReactNode;
	action?: React.ReactNode;
	changed?: FormFieldChange;
	/**
	 * `label`: 13px at 500 in the muted ink on an 18px row (the settings pages and the API key dialog of the 2026-11 redesign); a `changed` field there
	 * shows the dot alone, after the words. `caption` (the default): 12px in the subtle ink.
	 */
	size?: "caption" | "label";
	/** With `size="label"`: the length at the row's end ("0 / 2,000"), 12px faint; `danger` once it runs over. */
	count?: React.ReactNode;
	countTone?: "danger";
}) {
	if (size === "label") {
		return (
			<div data-slot="label-row" className="flex items-center gap-monti-6">
				<Label
					data-slot="field-label"
					size="label"
					tone="muted"
					className={cn("peer/field-label w-fit group-data-[disabled=true]/field:opacity-45", className)}
					{...props}
				>
					{aside === undefined ? (
						children
					) : (
						<span className="inline-flex items-center gap-monti-4">
							{children}
							<span data-slot="field-label-aside" className="text-monti-faint text-monti-note">
								{aside}
							</span>
						</span>
					)}
				</Label>
				{changed && <ChangeDot tone={changed.tone} label={changed.label} />}
				{count !== undefined && (
					<span
						data-slot="field-count"
						className={cn(
							"ml-auto font-mono text-monti-caption tabular-nums",
							countTone === "danger" ? "text-monti-danger" : "text-monti-faint",
						)}
					>
						{count}
					</span>
				)}
				{action}
			</div>
		);
	}
	const label = (
		<Label
			data-slot="field-label"
			size={size}
			tone="subtle"
			className={cn("peer/field-label w-fit group-data-[disabled=true]/field:opacity-45", className)}
			{...props}
		>
			{children}
		</Label>
	);
	if (changed) {
		return (
			<div data-slot="label-row" className="flex h-4 items-center gap-monti-8">
				{label}
				<ChangeDot tone={changed.tone} label={changed.label} />
				{(changed.onUndo || changed.undoShown) && (
					<TextButton
						variant="underline"
						quiet
						size="caption"
						className="ml-auto"
						ref={changed.undoRef}
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
		<div data-slot="label-row" className="flex h-4 items-center justify-between gap-monti-8">
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
				"flex w-fit items-center gap-monti-8 text-monti-label group-data-[disabled=true]/field:opacity-45",
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

/**
 * The error line under a field. `reserve` keeps the line (20px, 8px below the control: the field's 4px and 4px more) while it is empty, for a field whose error comes back
 * after the form is sent (a password): the button under it does not move when the error appears. `hint` fills that line in grey while there is no
 * error, for what the user must know before typing ("10자 이상"); the error takes its place. (cms-allow-korean)
 */
function FormFieldError({
	className,
	children,
	errors,
	reserve = false,
	hint,
	...props
}: React.ComponentProps<"div"> & {
	errors?: Array<{ message?: string } | undefined>;
	/** Keep the empty line so the form does not move when the error appears. */
	reserve?: boolean;
	/** With `reserve`: what the line says in grey while there is no error. */
	hint?: React.ReactNode;
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

	if (!content && !reserve) {
		return null;
	}
	if (!content && hint) {
		return (
			<div
				data-slot="field-hint"
				className={cn("mt-monti-4 min-h-5 text-monti-note text-monti-subtle", className)}
				{...props}
			>
				{hint}
			</div>
		);
	}

	return (
		<div
			role="alert"
			data-slot="field-error"
			className={cn(
				"whitespace-pre-wrap font-normal text-monti-danger text-monti-label",
				reserve && "mt-monti-4 min-h-5",
				className,
			)}
			{...props}
		>
			{content}
		</div>
	);
}

/**
 * One quiet line under a control, always shown (unlike a `FormFieldError` hint): what the value does, or the empty value's fallback. 12px faint;
 * `danger` while the value is wrong (what to fix, "14자를 줄여 주세요."); `icon` leads it at 12px (an ⓘ for a note about what saving will do, a ⚠ for
 * what a check refused). It stands 10px under the control in a `FormField spacing="label"`.
 */
function FormFieldHint({
	tone,
	icon,
	className,
	children,
	...props
}: React.ComponentProps<"div"> & { tone?: "danger"; icon?: React.ReactNode }) {
	return (
		<div
			data-slot="field-hint"
			role={tone === "danger" ? "alert" : undefined}
			className={cn(
				"mt-monti-4 flex items-center gap-monti-6 text-monti-caption [&_svg]:size-3 [&_svg]:shrink-0",
				tone === "danger" ? "text-monti-danger" : "text-monti-faint",
				className,
			)}
			{...props}
		>
			{icon}
			<span className="min-w-0">{children}</span>
		</div>
	);
}

/** The saved value an assistant's proposal would replace, struck through in blue right under the control. */
function FormFieldWas({ className, ...props }: React.ComponentProps<"del">) {
	return <Del data-slot="field-was" className={cn("block pt-monti-4 text-monti-caption", className)} {...props} />;
}

export {
	FormField,
	FormFieldWas,
	FormFieldLabel,
	FormFieldDescription,
	FormFieldError,
	FormFieldGroup,
	FormFieldHint,
	FormFieldLegend,
	FormFieldSet,
	FormFieldTitle,
};

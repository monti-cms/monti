"use client";

import { useMemo } from "react";
import { cn } from "./cn";
import { Label } from "./label";

function FormFieldSet({
	className,
	density = "default",
	...props
}: React.ComponentProps<"fieldset"> & { density?: "default" | "compact" }) {
	return (
		<fieldset
			data-slot="field-set"
			className={cn(
				"flex min-w-0 flex-col has-[>[data-slot=checkbox-group]]:gap-monti-12 has-[>[data-slot=radio-group]]:gap-monti-12",
				density === "compact" ? "gap-monti-16" : "gap-monti-24",
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
}: React.ComponentProps<"legend"> & { variant?: "legend" | "label" }) {
	return (
		<legend
			data-slot="field-legend"
			data-variant={variant}
			className={cn(
				"mb-monti-12 data-[variant=label]:text-monti-label data-[variant=legend]:text-monti-title",
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
				"group/field-group @container/field-group flex w-full flex-col gap-7 data-[slot=checkbox-group]:gap-monti-12 *:data-[slot=field-group]:gap-monti-16",
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

function FormFieldLabel({
	className,
	action,
	...props
}: React.ComponentProps<typeof Label> & { action?: React.ReactNode }) {
	const label = (
		<Label
			data-slot="field-label"
			size="micro"
			tone="subtle"
			className={cn("peer/field-label w-fit group-data-[disabled=true]/field:opacity-45", className)}
			{...props}
		/>
	);
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

"use client";

import type { FieldInputParts, FieldInputProps } from "@monti-cms/admin";
import { cn, Switch } from "@monti-cms/admin/kit";
import { type Site, SUMMARY_ROLE, useSite } from "@monti-cms/core/client";
import { SEO_DEFAULT_LIMITS } from "../fields";

/** Recommended length: field `max` → `inputOptions.limit` → default. */
const limitOf = (field: FieldInputProps["field"], fallback: number) => {
	if ("max" in field && typeof field.max === "number") return field.max;
	const limit = field.inputOptions?.limit;
	return typeof limit === "number" ? limit : fallback;
};

const current = (props: FieldInputProps) => (typeof props.value === "string" ? props.value : "");

/** Character count. Changes color when it exceeds the recommended length. When empty, it is the length of the fallback value. */
function Counter({ length, limit }: { length: number; limit: number }) {
	return (
		<span
			className={cn(
				"text-[11px] text-cms-muted-foreground tabular-nums",
				length > limit && "cms-dark:text-amber-400 text-amber-600",
			)}
		>
			{length}/{limit}
		</span>
	);
}

/** Input piece that shows a hint and character count using the value the public page falls back to when empty. */
const withFallback = (
	fallback: (site: Site, props: FieldInputProps) => string,
	defaultLimit: number,
): FieldInputParts => ({
	// The admin calls `placeholder` while it renders the input, and a registration always has one, so the hook runs in the same order on every render.
	placeholder: (props) => fallback(useSite(), props) || undefined,
	Aside: function FallbackCounter(props) {
		const site = useSite();
		return (
			<Counter length={(current(props) || fallback(site, props)).length} limit={limitOf(props.field, defaultLimit)} />
		);
	},
});

/** Search title: falls back to the title when empty. */
export const seoTitleInput = withFallback((_site, props) => props.form.title, SEO_DEFAULT_LIMITS.title);

/** Search description: falls back to the summary role value when empty. */
export const seoDescriptionInput = withFallback(
	(site, props) =>
		site.isCollection(props.collection) ? site.roleValue(props.collection, SUMMARY_ROLE, props.form) : "",
	SEO_DEFAULT_LIMITS.description,
);

/** Hide from search engines: a switch in the label row. On is `noindex`, off is the default (or another option). */
function NoindexSwitch({ field, id, value, describedBy, context, onChange }: FieldInputProps) {
	if (field.kind !== "select") return null;
	const off =
		field.defaultValue !== "noindex"
			? field.defaultValue
			: (Object.keys(field.options).find((option) => option !== "noindex") ?? field.defaultValue);
	const selected = typeof value === "string" ? value : field.defaultValue;
	return (
		<Switch
			id={id}
			size="sm"
			checked={selected === "noindex"}
			disabled={context.disabled}
			aria-describedby={describedBy}
			onCheckedChange={(checked) => onChange(checked ? "noindex" : off)}
		/>
	);
}

export const seoNoindexInput: FieldInputParts = { Input: null, Aside: NoindexSwitch };

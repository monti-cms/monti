"use client";

import { type FieldInputParts, type FieldInputProps, type Site, useSite, useTranslator } from "@monti-cms/admin";
import { Text } from "@monti-cms/admin/kit";
import { SUMMARY_ROLE } from "@monti-cms/core";
import { SEO_DEFAULT_LIMITS } from "../fields";
import { seoMessages } from "../messages";

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
		<Text variant="micro" tone={length > limit ? "warning" : "subtle"}>
			{length}/{limit}
		</Text>
	);
}

/**
 * Input pieces for a value the public page falls back to when it is empty: a hint and character count while it is edited, and what the properties list
 * reads while it is empty ("Same as the title", with the length of that title).
 */
const withFallback = (
	fallback: (site: Site, props: FieldInputProps) => string,
	defaultLimit: number,
	same: "same.title" | "same.description",
	countAtRest: boolean,
): FieldInputParts => ({
	// The admin calls `placeholder` while it renders the input, and a registration always has one, so the hook runs in the same order on every render.
	placeholder: (props) => fallback(useSite(), props) || undefined,
	Aside: function FallbackCounter(props) {
		const site = useSite();
		return (
			<Counter length={(current(props) || fallback(site, props)).length} limit={limitOf(props.field, defaultLimit)} />
		);
	},
	Empty: function SameAs(props) {
		const site = useSite();
		const t = useTranslator(seoMessages);
		const length = fallback(site, props).length;
		return (
			<>
				{t(same)}
				{countAtRest && (
					<Text as="span" variant="meta" tone="subtle">
						{" "}
						· {length}/{limitOf(props.field, defaultLimit)}
					</Text>
				)}
			</>
		);
	},
});

/** Search title: falls back to the title when empty. */
export const seoTitleInput = withFallback(
	(site, props) =>
		site.isCollection(props.collection) ? (site.titleOfValues(props.collection, props.form) ?? "") : "",
	SEO_DEFAULT_LIMITS.title,
	"same.title",
	true,
);

/** Search description: falls back to the summary role value when empty. */
export const seoDescriptionInput = withFallback(
	(site, props) =>
		site.isCollection(props.collection) ? site.roleValue(props.collection, SUMMARY_ROLE, props.form) : "",
	SEO_DEFAULT_LIMITS.description,
	"same.description",
	false,
);

/** Share image: reads "Same as the default image" while empty; the picker is the default one. */
export const seoImageInput: FieldInputParts = {
	Empty: function SameImage() {
		return <>{useTranslator(seoMessages)("same.image")}</>;
	},
};

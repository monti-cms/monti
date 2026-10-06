import type { BlockDefinition } from "../../blocks/define";
import type { CmsJsonValue } from "../../mdx/types";

/**
 * Reads the attributes of a stored block or mark by its definition into the flat props a component receives.
 *
 * - a boolean is always there (`false` when absent; `true` for `true` and `"true"`);
 * - a string is passed as is (a number is written out); a required string without options is `""` when absent;
 * - a choice (`options`) that is not one of the options is replaced by the default; with no default it is absent;
 * - a value of another kind (an object, a list, a boolean for a string) is malformed: the block goes to the fallback.
 */
export interface ReadAttributes {
	readonly props: Record<string, string | boolean | undefined>;
	/** The names of attributes whose stored value is of the wrong kind. */
	readonly malformed: readonly string[];
}

const isNothing = (value: CmsJsonValue | undefined) => value === undefined || value === null;

export const readAttributes = (
	definition: Pick<BlockDefinition, "attributes">,
	attrs: Record<string, CmsJsonValue> | undefined,
): ReadAttributes => {
	const props: Record<string, string | boolean | undefined> = {};
	const malformed: string[] = [];
	for (const [name, attribute] of Object.entries(definition.attributes)) {
		const value = attrs?.[name];
		if (attribute.type === "boolean") {
			if (value === true || value === "true") props[name] = true;
			else if (isNothing(value) || value === false || value === "false" || value === "") {
				props[name] = attribute.defaultValue === true && isNothing(value);
			} else {
				malformed.push(name);
				props[name] = false;
			}
			continue;
		}
		const fallback = typeof attribute.defaultValue === "string" ? attribute.defaultValue : undefined;
		if (isNothing(value)) {
			props[name] = fallback ?? (attribute.required && !attribute.options ? "" : undefined);
			continue;
		}
		if (typeof value !== "string" && typeof value !== "number") {
			malformed.push(name);
			props[name] = fallback;
			continue;
		}
		const text = String(value);
		if (attribute.options && !Object.hasOwn(attribute.options, text)) {
			// Not one of the choices (the pre-publish check reports it): the default, so the prop stays truthful.
			props[name] = fallback;
			continue;
		}
		props[name] = text;
	}
	return { props, malformed };
};

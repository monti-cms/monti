import { directiveBlocks } from "../blocks/derive";

/**
 * Directive name definition table.
 *
 * A table shared by the storage format and the renderer. It is built from the block definitions (`blocks/definitions.ts`).
 * To add a block, edit the block definitions.
 *
 * Only registered names are recognized as directives. An unregistered `:name` is turned back into body text at parse time
 * (`remark-directive` has no name filter option — "It exports no additional options.").
 */

export type DirectiveKind = "container" | "leaf" | "text";

export type DirectiveAttributeType = "string" | "boolean";

export type DirectiveDefinition = {
	/** Name in the storage syntax (lowercase kebab-case). */
	name: string;
	/** Directive kind. Decides the context when an unregistered node is turned back (text → text, others → paragraph). */
	kind: DirectiveKind;
	/** Element/component name used for rendering. Lowercase names are MDX intrinsic elements. */
	component: string;
	/** Attribute name → type. Attributes not listed here get a warning from the pre-publish check. */
	attributes: Record<string, DirectiveAttributeType>;
	/** Required attributes. If missing, the pre-publish check rejects the content. */
	required: readonly string[];
};

/** Directive table built from the block definitions (`blocks/definitions.ts`). */
export const DIRECTIVES: readonly DirectiveDefinition[] = directiveBlocks().map((block) => {
	const syntax = block.syntax as { kind: DirectiveKind; directive: string };
	return {
		name: syntax.directive,
		kind: syntax.kind,
		component: block.component,
		attributes: Object.fromEntries(Object.entries(block.attributes).map(([name, attribute]) => [name, attribute.type])),
		required: Object.entries(block.attributes)
			.filter(([, attribute]) => attribute.required)
			.map(([name]) => name),
	};
});

export const DIRECTIVE_BY_NAME: ReadonlyMap<string, DirectiveDefinition> = new Map(
	DIRECTIVES.map((definition) => [definition.name, definition]),
);

export const isRegisteredDirective = (name: string): boolean => DIRECTIVE_BY_NAME.has(name);

/** Set of registered directive names. Used when saving to tell them apart from body text (the `\:` rule). */
export const DIRECTIVE_NAMES: ReadonlySet<string> = new Set(DIRECTIVES.map((definition) => definition.name));

/** Component name → definition. Used by the write path (serializer) to find a directive by its JSX name. */
export const DIRECTIVE_BY_COMPONENT: ReadonlyMap<string, DirectiveDefinition> = new Map(
	DIRECTIVES.map((definition) => [definition.component, definition]),
);

export { TEXT_ALIGN_VALUES } from "../blocks/derive";

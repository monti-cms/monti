import { directiveBlocks } from "../blocks/derive";

/**
 * Table of blocks written as elements (containers, leaves and text blocks), by renderer name. The pre-publish check reads attribute rules from it.
 * It is built from the block definitions (`blocks/definitions.ts`). To add a block, edit the block definitions.
 *
 * It does not depend on the stored notation: JSX and the directive extension (`@monti-cms/core/syntax`) both parse to the same component names.
 */

export type DirectiveKind = "container" | "leaf" | "text";

export type DirectiveAttributeType = "string" | "boolean";

export type DirectiveDefinition = {
	/** Block name (lowercase kebab-case). */
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

/** Component name → definition. */
export const DIRECTIVE_BY_COMPONENT: ReadonlyMap<string, DirectiveDefinition> = new Map(
	DIRECTIVES.map((definition) => [definition.component, definition]),
);

export { TEXT_ALIGN_VALUES } from "../blocks/derive";

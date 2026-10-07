import type { Site } from "@monti-cms/core/client";
import { perSite } from "./per-site";

/**
 * Table of blocks written as elements (containers, leaves and text blocks), by renderer name. The pre-publish check reads attribute rules from it.
 * It is built from the site's block definitions (`blocks/definitions.ts` and the blocks the site adds).
 *
 * It does not depend on the stored notation: JSX and the directive extension (`@monti-cms/syntax-directive`) both parse to the same component names.
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

/** The directive table of a site. */
export interface Directives {
	/** Directive table built from the site's block definitions. */
	readonly DIRECTIVES: readonly DirectiveDefinition[];
	/** Component name → definition. */
	readonly DIRECTIVE_BY_COMPONENT: ReadonlyMap<string, DirectiveDefinition>;
}

/** The directive table of a site. */
export const directivesOf = perSite((site: Pick<Site, "directiveBlocks">): Directives => {
	const DIRECTIVES: readonly DirectiveDefinition[] = site.directiveBlocks().map((block) => {
		const syntax = block.syntax as { kind: DirectiveKind; directive: string };
		return {
			name: syntax.directive,
			kind: syntax.kind,
			component: block.component,
			attributes: Object.fromEntries(
				Object.entries(block.attributes).map(([name, attribute]) => [name, attribute.type]),
			),
			required: Object.entries(block.attributes)
				.filter(([, attribute]) => attribute.required)
				.map(([name]) => name),
		};
	});
	return {
		DIRECTIVES,
		DIRECTIVE_BY_COMPONENT: new Map(DIRECTIVES.map((definition) => [definition.component, definition])),
	};
});

export { TEXT_ALIGN_VALUES } from "@monti-cms/core/client";

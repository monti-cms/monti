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
export declare const DIRECTIVES: readonly DirectiveDefinition[];
export declare const DIRECTIVE_BY_NAME: ReadonlyMap<string, DirectiveDefinition>;
export declare const isRegisteredDirective: (name: string) => boolean;
/** Set of registered directive names. Used when saving to tell them apart from body text (the `\:` rule). */
export declare const DIRECTIVE_NAMES: ReadonlySet<string>;
/** Component name → definition. Used by the write path (serializer) to find a directive by its JSX name. */
export declare const DIRECTIVE_BY_COMPONENT: ReadonlyMap<string, DirectiveDefinition>;
export { TEXT_ALIGN_VALUES } from "../blocks/derive.js";

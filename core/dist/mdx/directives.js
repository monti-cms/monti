import { directiveBlocks } from "../blocks/derive.js";
/** Directive table built from the block definitions (`blocks/definitions.ts`). */
export const DIRECTIVES = directiveBlocks().map((block) => {
    const syntax = block.syntax;
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
export const DIRECTIVE_BY_NAME = new Map(DIRECTIVES.map((definition) => [definition.name, definition]));
export const isRegisteredDirective = (name) => DIRECTIVE_BY_NAME.has(name);
/** Set of registered directive names. Used when saving to tell them apart from body text (the `\:` rule). */
export const DIRECTIVE_NAMES = new Set(DIRECTIVES.map((definition) => definition.name));
/** Component name → definition. Used by the write path (serializer) to find a directive by its JSX name. */
export const DIRECTIVE_BY_COMPONENT = new Map(DIRECTIVES.map((definition) => [definition.component, definition]));
export { TEXT_ALIGN_VALUES } from "../blocks/derive.js";

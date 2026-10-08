import { perSite } from "./per-site.js";
/** The directive table of a site. */
export const directivesOf = perSite((site) => {
    const DIRECTIVES = site.directiveBlocks().map((block) => {
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
    return {
        DIRECTIVES,
        DIRECTIVE_BY_COMPONENT: new Map(DIRECTIVES.map((definition) => [definition.component, definition])),
    };
});
export { TEXT_ALIGN_VALUES } from "@monti-cms/core/client";

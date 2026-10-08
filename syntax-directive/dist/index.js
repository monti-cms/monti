import remarkDirective from "remark-directive";
import { directiveDefinitions, remarkDemoteUnknownDirectives, remarkDirectivesToMdx } from "./remark.js";
import { directiveMarkWriters, directiveNodeWriters, escapeDirectiveColon, escapeDirectiveText } from "./serialize.js";
/**
 * Directive syntax (`remark-directive`): `:::name` containers, `::name` leaves and `:name[label]` text, for the registered blocks.
 * A `:name` that is not a registered block is kept as ordinary text.
 *
 * Line breaks are not written as directives: they are always `<br />`.
 *
 * @experimental
 */
export const directiveSyntax = (options = {}) => ({
    name: "directive",
    remarkPlugins: (context) => {
        const definitions = directiveDefinitions(context.blocks);
        return [remarkDirective, [remarkDemoteUnknownDirectives, definitions], [remarkDirectivesToMdx, definitions]];
    },
    // Text that would be read as a directive is escaped even when nothing is written as a directive: the extension still reads them.
    ...(options.write === false
        ? { escapeText: escapeDirectiveColon }
        : { fromDocument: directiveNodeWriters, fromMark: directiveMarkWriters, escapeText: escapeDirectiveText }),
});

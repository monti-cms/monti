import type { SyntaxExtension } from "@monti-cms/core/syntax";
import remarkDirective from "remark-directive";
import { directiveDefinitions, remarkDemoteUnknownDirectives, remarkDirectivesToMdx } from "./remark";
import { directiveMarkWriters, directiveNodeWriters, escapeDirectiveColon, escapeDirectiveText } from "./serialize";

export interface DirectiveSyntaxOptions {
	/**
	 * Whether saving writes directives (`:::callout`, `::image{…}`, `:u[…]`). Default `true`.
	 * `false` reads directives but writes standard MDX (JSX), which migrates existing content a post at a time as it is saved.
	 * Text that looks like a directive (`:u`) is still escaped (`\:u`), because the extension still reads directives.
	 */
	readonly write?: boolean;
}

/**
 * Directive syntax (`remark-directive`): `:::name` containers, `::name` leaves and `:name[label]` text, for the registered blocks.
 * A `:name` that is not a registered block is kept as ordinary text.
 *
 * Line breaks are not written as directives: they are always `<br />`.
 *
 * @experimental
 */
export const directiveSyntax = (options: DirectiveSyntaxOptions = {}): SyntaxExtension => ({
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

import type { BlockDefinition } from "../blocks/define.js";
import type { CmsJsonValue } from "../doc/types.js";
import type { BodyPosition, Issue } from "./types.js";
/**
 * Links from body text to code lines (a text block whose attribute has `codeAnchor`, such as `:code-ref[text]{to="c1"}`) and the line
 * labels they point to (the `anchor` line effect, `// @line anchor {2-4} id="c1"`).
 *
 * A label names lines of one code block and is unique within the body, so a link resolves to exactly one code block. Before publishing:
 * - a link whose label no code block has is a blocking issue (`code_ref_broken`): on the public page it would be plain text;
 * - a label that a second code block uses again is a warning (`code_anchor_duplicate`): links resolve to the first, the copy links nothing.
 */
export declare class CodeRefCollector {
    private readonly anchors;
    private readonly refs;
    private readonly anchorAttributes;
    /** `blocks` is the site's block table (`site.BLOCK_BY_NAME`). */
    constructor(blocks: ReadonlyMap<string, BlockDefinition>);
    /** Collects the labels of a stored code block (its `annotations.lines` hold the line effects as data). */
    addCode(attrs: Readonly<Record<string, CmsJsonValue>> | undefined, position: BodyPosition): void;
    /** Collects the link of a block or text mark (by its block name) when its definition says it links code lines. */
    addBlock(name: string, attrs: Readonly<Record<string, CmsJsonValue>> | undefined, position: BodyPosition): void;
    /** Blocking issues and warnings, in body order. */
    check(): {
        issues: Issue[];
        warnings: Issue[];
    };
}

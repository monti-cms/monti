import { ANCHOR } from "../annotation/code-block/model";
import { BLOCK_BY_NAME } from "../blocks/derive";
import type { CmsJsonValue } from "../doc/types";
import type { BodyPosition, Issue } from "./types";

/**
 * Links from body text to code lines (a text block whose attribute has `codeAnchor`, such as `:code-ref[text]{to="c1"}`) and the line
 * labels they point to (the `anchor` line effect, `// @line anchor {2-4} id="c1"`).
 *
 * A label names lines of one code block and is unique within the body, so a link resolves to exactly one code block. Before publishing:
 * - a link whose label no code block has is a blocking issue (`code_ref_broken`): on the public page it would be plain text;
 * - a label that a second code block uses again is a warning (`code_anchor_duplicate`): links resolve to the first, the copy links nothing.
 */
export class CodeRefCollector {
	private readonly anchors: { id: string; position: BodyPosition }[] = [];
	private readonly refs: { id: string; position: BodyPosition }[] = [];

	/** Collects the labels of a stored code block (its `annotations.lines` hold the line effects as data). */
	addCode(attrs: Readonly<Record<string, CmsJsonValue>> | undefined, position: BodyPosition) {
		const lines = (attrs?.annotations as { lines?: unknown } | undefined)?.lines;
		if (!Array.isArray(lines)) return;
		const ids = new Set<string>();
		for (const annotation of lines as { name?: unknown; attrs?: { id?: unknown } }[]) {
			if (annotation?.name !== ANCHOR) continue;
			const id = annotation.attrs?.id;
			if (typeof id === "string" && id) ids.add(id);
		}
		// One block may label several line ranges; a label it repeats is still one block's.
		for (const id of ids) this.anchors.push({ id, position });
	}

	/** Collects the link of a block or text mark (by its block name) when its definition says it links code lines. */
	addBlock(name: string, attrs: Readonly<Record<string, CmsJsonValue>> | undefined, position: BodyPosition) {
		const attribute = CODE_ANCHOR_ATTRIBUTE_BY_BLOCK.get(name);
		if (!attribute) return;
		const id = attrs?.[attribute];
		// An empty or missing value is already a `missing_block_attribute` issue.
		if (typeof id === "string" && id.trim()) this.refs.push({ id, position });
	}

	/** Blocking issues and warnings, in body order. */
	check(): { issues: Issue[]; warnings: Issue[] } {
		const issues: Issue[] = [];
		const warnings: Issue[] = [];
		const labelled = new Set<string>();
		for (const anchor of this.anchors) {
			if (labelled.has(anchor.id)) {
				warnings.push({
					code: "code_anchor_duplicate",
					message: anchor.id,
					params: { id: anchor.id },
					path: "body",
					position: anchor.position,
				});
			}
			labelled.add(anchor.id);
		}
		for (const ref of this.refs) {
			if (labelled.has(ref.id)) continue;
			issues.push({
				code: "code_ref_broken",
				message: ref.id,
				params: { id: ref.id },
				path: "body",
				position: ref.position,
			});
		}
		return { issues, warnings };
	}
}

/** Block name → the attribute holding the line label, for the blocks that link code lines. */
const CODE_ANCHOR_ATTRIBUTE_BY_BLOCK: ReadonlyMap<string, string> = new Map(
	[...BLOCK_BY_NAME].flatMap(([name, block]) => {
		const attribute = Object.entries(block.attributes).find(([, item]) => item.codeAnchor)?.[0];
		return attribute ? [[name, attribute] as const] : [];
	}),
);

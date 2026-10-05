import { annotationConfig } from "../annotation/code-block/active";
import { fromCodeFenceToCodeBlockDocument } from "../annotation/code-block/code-fence-to-document";
import { ANCHOR } from "../annotation/code-block/model";
import { BLOCK_BY_NAME } from "../blocks/derive";
import { DIRECTIVE_BY_COMPONENT } from "../mdx/directives";
import type { CmsBodyPosition } from "../mdx/types";
import type { Issue } from "./types";

/**
 * Links from body text to code lines (a text block whose attribute has `codeAnchor`, such as `:code-ref[text]{to="c1"}`) and the line
 * labels they point to (the `anchor` line effect, `// @line anchor {2-4} id="c1"`).
 *
 * A label names lines of one code block and is unique within the body, so a link resolves to exactly one code block. Before publishing:
 * - a link whose label no code block has is a blocking issue (`code_ref_broken`): on the public page it would be plain text;
 * - a label that a second code block uses again is a warning (`code_anchor_duplicate`): links resolve to the first, the copy links nothing.
 */
export class CodeRefCollector {
	private readonly anchors: { id: string; position: CmsBodyPosition }[] = [];
	private readonly refs: { id: string; position: CmsBodyPosition }[] = [];

	/** Collects the labels of a code fence (an mdast `code` node). */
	addCode(node: { lang?: unknown; meta?: unknown; value?: unknown }, position: CmsBodyPosition) {
		if (typeof node.value !== "string" || !node.value.includes(ANCHOR)) return;
		const document = fromCodeFenceToCodeBlockDocument(
			{
				type: "code",
				lang: typeof node.lang === "string" ? node.lang : undefined,
				meta: typeof node.meta === "string" ? node.meta : undefined,
				value: node.value,
			},
			annotationConfig,
		);
		const ids = new Set<string>();
		for (const annotation of document.annotations) {
			if (annotation.name !== ANCHOR) continue;
			const id = annotation.attributes?.find((attribute) => attribute.name === "id")?.value;
			if (typeof id === "string" && id) ids.add(id);
		}
		// One block may label several line ranges; a label it repeats is still one block's.
		for (const id of ids) this.anchors.push({ id, position });
	}

	/** Collects the link of a JSX element (a directive is parsed to one) when its block links code lines. */
	addElement(name: string, readValue: (key: string) => string | true | undefined, position: CmsBodyPosition) {
		const attribute = CODE_ANCHOR_ATTRIBUTE_BY_COMPONENT.get(name);
		if (!attribute) return;
		const id = readValue(attribute);
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
					path: "mdx",
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
				path: "mdx",
				position: ref.position,
			});
		}
		return { issues, warnings };
	}
}

/** JSX component name → the attribute holding the line label, for the blocks that link code lines. */
const CODE_ANCHOR_ATTRIBUTE_BY_COMPONENT: ReadonlyMap<string, string> = new Map(
	[...DIRECTIVE_BY_COMPONENT].flatMap(([component, directive]) => {
		const block = BLOCK_BY_NAME.get(directive.name);
		const attribute = Object.entries(block?.attributes ?? {}).find(([, item]) => item.codeAnchor)?.[0];
		return attribute ? [[component, attribute] as const] : [];
	}),
);

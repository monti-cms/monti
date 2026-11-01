import { type BlockDefinition, type CmsConfig, defineBlock } from "@monti-cms/core";
import type { CmsNode, StoredDocument } from "@monti-cms/core/document";
import { createSite } from "@monti-cms/core/site";
import { text } from "../../../test/stored-doc";

/**
 * The body side of the link is a text decoration whose attribute points at a code line (`codeAnchor`, like the blocks extension's code link). It is
 * defined here, and stands in for any such decoration the site has, so the code link tests run on any site config.
 */
const lineRef = defineBlock({
	name: "test-line-ref",
	label: "Line link",
	syntax: { kind: "text", directive: "test-line-ref" },
	component: "TestLineRef",
	attributes: { to: { type: "string", label: "Line", required: true, codeAnchor: true } },
	editor: { view: "mark" },
});
const pointsAtCode = (block: BlockDefinition) =>
	Object.values(block.attributes ?? {}).some((attribute) => attribute.codeAnchor === true);

/** The site of `config` with `lineRef` as its only text decoration that points at code. */
export const lineRefSite = (config: CmsConfig) =>
	createSite({
		...config,
		blocks: [...(config.blocks ?? []).filter((block) => !pointsAtCode(block)), lineRef],
	} as CmsConfig);

/** A text node linked to the code line labelled `to`. */
export const codeLink = (value: string, to: string): CmsNode => text(value, [{ type: lineRef.name, attrs: { to } }]);

/** The targets (`to`) of the code links of a document, in document order. */
export const codeLinkTargetsOf = (doc: StoredDocument): string[] => {
	const targets: string[] = [];
	const walk = (nodes: readonly CmsNode[]) => {
		for (const node of nodes) {
			for (const mark of node.marks ?? [])
				if (mark.type === lineRef.name && typeof mark.attrs?.to === "string") targets.push(mark.attrs.to);
			if (node.content) walk(node.content);
		}
	};
	walk(doc.content);
	return targets;
};

import { ADDED_BLOCKS } from "@monti-cms/core/client";
/**
 * Editor representation of added blocks (block extension plugins and the site config's `blocks`). Blocks with `editor.view: "node"` are edited as
 * Tiptap nodes built from the definition; the rest stay as source-preserving boxes.
 */
/** Tiptap node name of an added block (`cms` + PascalCase name, e.g. `callout` → `cmsCallout`). */
export const blockNodeName = (block) => `cms${block.name.replace(/(^|-)([a-z0-9])/g, (_, _dash, char) => char.toUpperCase())}`;
/** Names the editor already uses. An added block's node name must not collide with them. */
const TAKEN_NODE_NAMES = new Set(["cmsOpaqueBlock", "cmsMath", "cmsBlockKeymap", "cmsBlockDrag", "cmsUntranslated"]);
/** Added blocks edited as editor nodes. */
export const ADDED_NODE_BLOCKS = ADDED_BLOCKS.filter((block) => block.editor.view === "node");
for (const block of ADDED_NODE_BLOCKS) {
    if (TAKEN_NODE_NAMES.has(blockNodeName(block))) {
        throw new Error(`cms block "${block.name}": editor node name ${blockNodeName(block)} is already used`);
    }
}
const BY_NODE_NAME = new Map(ADDED_NODE_BLOCKS.map((block) => [blockNodeName(block), block]));
/** Tiptap node name → added block definition. */
export const addedBlockOfNode = (nodeName) => BY_NODE_NAME.get(nodeName);
/** Default attribute values of a block definition. */
export const defaultValues = (block) => Object.fromEntries(Object.entries(block.attributes).flatMap(([name, attribute]) => attribute.defaultValue === undefined ? [] : [[name, attribute.defaultValue]]));
/** Whether this is a container block (holds body content or child blocks). */
export const isContainer = (block) => block.syntax.kind === "container";
/** Whether this is a code fence block. */
export const isFence = (block) => block.syntax.kind === "fence";
/** Whether this container holds general body content rather than fixed child blocks (e.g. a callout or a single tab). */
export const isBodyContainer = (block) => isContainer(block) && !block.children?.blocks?.length;
/** Child block definition. */
export const childBlocksOf = (block, all = ADDED_NODE_BLOCKS) => (block.children?.blocks ?? []).flatMap((name) => all.find((candidate) => candidate.name === name) ?? []);
/** Container block node names. Child blocks can be moved one at a time with the handle. */
export const CONTAINER_NODE_NAMES = new Set(ADDED_NODE_BLOCKS.filter(isContainer).map(blockNodeName));
/** Container node names that require at least one body block (e.g. a callout or a single tab). */
export const BODY_CONTAINER_NODE_NAMES = new Set(ADDED_NODE_BLOCKS.filter(isBodyContainer).map(blockNodeName));
/** Frame inside a parent block (e.g. a single tab or column). Not moved on its own. */
export const PARENT_ONLY_NODE_NAMES = new Set(ADDED_NODE_BLOCKS.filter((block) => block.parent).map(blockNodeName));

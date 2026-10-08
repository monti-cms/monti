import { perSite } from "@monti-cms/core/client";
/**
 * Editor representation of added blocks (block extension plugins and the site config's `blocks`). Blocks with `editor.view: "node"` are edited as
 * Tiptap nodes built from the definition; the rest stay as source-preserving boxes.
 */
/** Tiptap node name of an added block (`cms` + PascalCase name, e.g. `callout` → `cmsCallout`). */
export const blockNodeName = (block) => `cms${block.name.replace(/(^|-)([a-z0-9])/g, (_, _dash, char) => char.toUpperCase())}`;
/**
 * ProseMirror node groups that tell the drag and block commands what an added block node is, without a site: a container (it holds blocks), a body container (it
 * holds general body content, so an emptied one gets a paragraph back). A node is in the group through its `group` spec, so the commands read it from the node type.
 */
export const CONTAINER_GROUP = "cmsContainer";
export const BODY_CONTAINER_GROUP = "cmsBodyContainer";
/** Class on the node view of a block used only inside a parent block (a single tab or column), so the pointer logic can tell such a frame from the DOM. */
export const PARENT_ONLY_VIEW_CLASS = "cms-parent-only-block";
/** Names the editor already uses. An added block's node name must not collide with them. */
const TAKEN_NODE_NAMES = new Set(["cmsOpaqueBlock", "cmsMath", "cmsBlockKeymap", "cmsBlockDrag", "cmsUntranslated"]);
const tablesOf = perSite((site) => {
    const nodeBlocks = site.ADDED_BLOCKS.filter((block) => block.editor.view === "node");
    for (const block of nodeBlocks) {
        if (TAKEN_NODE_NAMES.has(blockNodeName(block))) {
            throw new Error(`cms block "${block.name}": editor node name ${blockNodeName(block)} is already used`);
        }
    }
    return { nodeBlocks, byNodeName: new Map(nodeBlocks.map((block) => [blockNodeName(block), block])) };
});
/** Added blocks edited as editor nodes. */
export const addedNodeBlocks = (site) => tablesOf(site).nodeBlocks;
/** Tiptap node name → added block definition. */
export const addedBlockOfNode = (site, nodeName) => tablesOf(site).byNodeName.get(nodeName);
/** Default attribute values of a block definition. */
export const defaultValues = (block) => Object.fromEntries(Object.entries(block.attributes).flatMap(([name, attribute]) => attribute.defaultValue === undefined ? [] : [[name, attribute.defaultValue]]));
/** Whether this is a container block (holds body content or child blocks). */
export const isContainer = (block) => block.syntax.kind === "container";
/** Whether this is a code fence block. */
export const isFence = (block) => block.syntax.kind === "fence";
/** Whether this container holds general body content rather than fixed child blocks (e.g. a callout or a single tab). */
export const isBodyContainer = (block) => isContainer(block) && !block.children?.blocks?.length;
/** Child block definition. */
export const childBlocksOf = (block, all) => (block.children?.blocks ?? []).flatMap((name) => all.find((candidate) => candidate.name === name) ?? []);

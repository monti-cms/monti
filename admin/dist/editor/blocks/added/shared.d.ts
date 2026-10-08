import { type BlockDefinition, type Site } from "@monti-cms/core/client";
/**
 * Editor representation of added blocks (block extension plugins and the site config's `blocks`). Blocks with `editor.view: "node"` are edited as
 * Tiptap nodes built from the definition; the rest stay as source-preserving boxes.
 */
/** Tiptap node name of an added block (`cms` + PascalCase name, e.g. `callout` → `cmsCallout`). */
export declare const blockNodeName: (block: Pick<BlockDefinition, "name">) => string;
/**
 * ProseMirror node groups that tell the drag and block commands what an added block node is, without a site: a container (it holds blocks), a body container (it
 * holds general body content, so an emptied one gets a paragraph back). A node is in the group through its `group` spec, so the commands read it from the node type.
 */
export declare const CONTAINER_GROUP = "cmsContainer";
export declare const BODY_CONTAINER_GROUP = "cmsBodyContainer";
/** Class on the node view of a block used only inside a parent block (a single tab or column), so the pointer logic can tell such a frame from the DOM. */
export declare const PARENT_ONLY_VIEW_CLASS = "cms-parent-only-block";
/** Added blocks edited as editor nodes. */
export declare const addedNodeBlocks: (site: Pick<Site, "ADDED_BLOCKS">) => readonly BlockDefinition[];
/** Tiptap node name → added block definition. */
export declare const addedBlockOfNode: (site: Pick<Site, "ADDED_BLOCKS">, nodeName: string) => BlockDefinition | undefined;
/** Default attribute values of a block definition. */
export declare const defaultValues: (block: BlockDefinition) => Record<string, string | boolean>;
/** Whether this is a container block (holds body content or child blocks). */
export declare const isContainer: (block: BlockDefinition) => boolean;
/** Whether this is a code fence block. */
export declare const isFence: (block: BlockDefinition) => boolean;
/** Whether this container holds general body content rather than fixed child blocks (e.g. a callout or a single tab). */
export declare const isBodyContainer: (block: BlockDefinition) => boolean;
/** Child block definition. */
export declare const childBlocksOf: (block: BlockDefinition, all: readonly BlockDefinition[]) => BlockDefinition[];

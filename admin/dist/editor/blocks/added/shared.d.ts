import type { BlockDefinition } from "@monti-cms/core/client";
/**
 * Editor representation of added blocks (block extension plugins and the site config's `blocks`). Blocks with `editor.view: "node"` are edited as
 * Tiptap nodes built from the definition; the rest stay as source-preserving boxes.
 */
/** Tiptap node name of an added block (`cms` + PascalCase name, e.g. `callout` → `cmsCallout`). */
export declare const blockNodeName: (block: Pick<BlockDefinition, "name">) => string;
/** Added blocks edited as editor nodes. */
export declare const ADDED_NODE_BLOCKS: readonly BlockDefinition[];
/** Tiptap node name → added block definition. */
export declare const addedBlockOfNode: (nodeName: string) => BlockDefinition | undefined;
/** Default attribute values of a block definition. */
export declare const defaultValues: (block: BlockDefinition) => Record<string, string | boolean>;
/** Whether this is a container block (holds body content or child blocks). */
export declare const isContainer: (block: BlockDefinition) => boolean;
/** Whether this is a code fence block. */
export declare const isFence: (block: BlockDefinition) => boolean;
/** Whether this container holds general body content rather than fixed child blocks (e.g. a callout or a single tab). */
export declare const isBodyContainer: (block: BlockDefinition) => boolean;
/** Child block definition. */
export declare const childBlocksOf: (block: BlockDefinition, all?: readonly BlockDefinition[]) => BlockDefinition[];
/** Container block node names. Child blocks can be moved one at a time with the handle. */
export declare const CONTAINER_NODE_NAMES: ReadonlySet<string>;
/** Container node names that require at least one body block (e.g. a callout or a single tab). */
export declare const BODY_CONTAINER_NODE_NAMES: ReadonlySet<string>;
/** Frame inside a parent block (e.g. a single tab or column). Not moved on its own. */
export declare const PARENT_ONLY_NODE_NAMES: ReadonlySet<string>;

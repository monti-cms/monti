import type { Editor } from "@tiptap/core";
import type { Node as PmNode } from "@tiptap/pm/model";
/**
 * Block helpers without UI: look constants, the `values` attribute of added blocks, child positions and the editable state.
 * Kept free of `ui/*` and icon imports, so `useBlockEditor` (which the hooks entry point exports) can use them.
 */
/** Selected block border. All blocks use the same look. */
export declare const SELECTED_RING = "ring-2 ring-cms-ring ring-offset-2 ring-offset-cms-background";
/** Look of the control toolbar floating over a block (shared by the block toolbar, images, and tables). */
export declare const BLOCK_TOOLBAR = "z-10 flex items-center gap-0.5 rounded-md border bg-cms-popover/95 p-0.5 text-cms-popover-foreground shadow-sm backdrop-blur";
export type ContainerValues = Record<string, string | boolean>;
/** The directive attribute values of an added block (the `values` attribute of its node). */
export declare const valuesOf: (node: PmNode) => ContainerValues;
/** Emptied values (empty string, false) are removed from attributes. Keeping them would save a `title=""` that was not in the source. */
export declare const withValue: (values: ContainerValues, key: string, value: string | boolean) => ContainerValues;
/** Start position of the i-th child inside the parent container. */
export declare const childPos: (parent: PmNode, parentPos: number, index: number) => number;
/**
 * Whether the editor can be edited. Re-renders when the lock (trash, raw mode) changes.
 * A node view that reads `editor.isEditable` once while rendering does not follow lock changes, so use this.
 */
export declare function useEditorEditable(editor: Editor | null | undefined): boolean;

import type { Editor } from "@tiptap/core";
import type { Node as PmNode } from "@tiptap/pm/model";
import { useEditorState } from "@tiptap/react";

/**
 * Block helpers without UI: look constants, the `values` attribute of added blocks, child positions and the editable state.
 * Kept free of `ui/*` and icon imports, so `useBlockEditor` (which the hooks entry point exports) can use them.
 */

/** Selected block border. All blocks use the same look. */
export const SELECTED_RING = "ring-2 ring-cms-ring ring-offset-2 ring-offset-cms-background";

/** Look of the control toolbar floating over a block (shared by the block toolbar, images, and tables). */
export const BLOCK_TOOLBAR =
	"z-10 flex items-center gap-0.5 rounded-md border bg-cms-popover/95 p-0.5 text-cms-popover-foreground shadow-sm backdrop-blur";

export type ContainerValues = Record<string, string | boolean>;

/** The directive attribute values of an added block (the `values` attribute of its node). */
export const valuesOf = (node: PmNode): ContainerValues => (node.attrs.values ?? {}) as ContainerValues;

/** Emptied values (empty string, false) are removed from attributes. Keeping them would save a `title=""` that was not in the source. */
export const withValue = (values: ContainerValues, key: string, value: string | boolean): ContainerValues => {
	const { [key]: _removed, ...rest } = values;
	return value === "" || value === false ? rest : { ...rest, [key]: value };
};

/** Start position of the i-th child inside the parent container. */
export const childPos = (parent: PmNode, parentPos: number, index: number) => {
	let offset = parentPos + 1;
	for (let i = 0; i < index; i += 1) offset += parent.child(i).nodeSize;
	return offset;
};

/**
 * Whether the editor can be edited. Re-renders when the lock (trash, raw mode) changes.
 * A node view that reads `editor.isEditable` once while rendering does not follow lock changes, so use this.
 */
export function useEditorEditable(editor: Editor | null | undefined): boolean {
	// When rendering without an editor (preview, fake editor in tests), do not subscribe and read the value at that time.
	const tracked = typeof editor?.on === "function" ? editor : null;
	const editable = useEditorState({
		editor: tracked,
		selector: ({ editor: current }) => current?.isEditable ?? true,
	});
	return tracked ? (editable ?? true) : (editor?.isEditable ?? true);
}

import { type NodeViewProps } from "@tiptap/react";
import { type ReactNode } from "react";
/** Name and input hint of blocks written as code and viewed as a preview (math and code fence blocks). */
export interface FenceEditorMeta {
    /** `data-fence-preview` value (e.g. `math`, the fence language). */
    readonly kind: string;
    readonly label: string;
    /** Example code shown when the input field is empty. */
    readonly placeholder: string;
    readonly preview: (value: string) => ReactNode;
}
/**
 * Edit view showing the code input field and the preview together. Selecting or clicking opens the input field; otherwise only the preview shows.
 * Input is written to the document after a short pause or when leaving the field (not during Korean composition).
 */
export declare function FencePreviewNodeView({ node, updateAttributes, selected, editor, meta, }: NodeViewProps & {
    readonly meta: FenceEditorMeta;
}): import("react").JSX.Element;

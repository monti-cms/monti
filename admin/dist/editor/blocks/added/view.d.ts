import { type BlockDefinition } from "@monti-cms/core/client";
import { type NodeViewProps } from "@tiptap/react";
import type { ReactNode } from "react";
import { type ContainerValues } from "../shared.js";
/** Values received by the edit component that a site or blocks extension registers for a block (`CmsAdminComponents.blockEditors`). */
export interface CustomBlockEditorProps {
    readonly definition: BlockDefinition;
    /** Directive attribute values. Emptied values (empty string, false) are not saved. */
    readonly values: Readonly<ContainerValues>;
    readonly setValue: (name: string, value: string | boolean) => void;
    /** Slot for the container block body. Rendered where the body goes. `null` for single-line blocks. */
    readonly content: ReactNode;
    readonly editable: boolean;
    readonly selected: boolean;
}
/** Default NodeView of a directive block. If an edit component (`blockEditors[block name]`) is registered, it is used to render. */
export declare function CustomBlockNodeView(props: NodeViewProps): import("react").JSX.Element;
/**
 * NodeView of an added block. If a blocks extension or site supplies the whole edit view (`blockViews[block name]`) it is used; otherwise a code fence
 * block is drawn as a code and preview view, and a directive block as an attribute and body box.
 */
export declare function AddedBlockNodeView(props: NodeViewProps): import("react").JSX.Element;

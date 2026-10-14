import type { IncomingReferenceItem } from "@monti-cms/core/runtime";
import type { Ref } from "react";
import { type usePanelResize } from "../../ui/panel-resize.js";
import type { EntryEditor } from "./entry-editor-types.js";
type TranslationSource = NonNullable<EntryEditor["translation"]>["source"];
export declare function TranslationSourcePanel({ source, paneRef, onClose, }: {
    source: TranslationSource;
    paneRef: Ref<HTMLElement>;
    onClose: () => void;
}): import("react").JSX.Element;
interface InspectorSidePanelProps {
    editor: EntryEditor;
    resize: ReturnType<typeof usePanelResize>;
    incomingItems: IncomingReferenceItem[];
    isLoadingIncoming: boolean;
    onRefreshIncoming: (entryId: string) => void;
    onClose: () => void;
    focusPath: string | null;
    onFocused: () => void;
}
export declare function InspectorSidePanel({ editor, resize, incomingItems, isLoadingIncoming, onRefreshIncoming, onClose, focusPath, onFocused, }: InspectorSidePanelProps): import("react").JSX.Element;
export {};

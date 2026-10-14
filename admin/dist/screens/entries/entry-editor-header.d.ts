import type { EntryEditor } from "./entry-editor-types.js";
import type { EntryLifecycleCommands } from "./use-entry-lifecycle-commands.js";
interface EntryEditorHeaderProps {
    editor: EntryEditor;
    commands: EntryLifecycleCommands;
    statusLabel: string;
    isInspectorOpen: boolean;
    onToggleInspector: () => void;
}
export declare function EntryEditorHeader({ editor, commands, statusLabel, isInspectorOpen, onToggleInspector, }: EntryEditorHeaderProps): import("react").JSX.Element;
export {};

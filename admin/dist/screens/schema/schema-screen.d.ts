import type { SchemaTab } from "../settings/tabs.js";
/** The schema file editor: edits `monti.schema.ts` on the development server, shows it read-only everywhere else. `tab` is the Settings tab being shown. */
export declare function SchemaSettings({ tab, actionsSlot, fileSlot, onTab, }: {
    tab: SchemaTab;
    actionsSlot?: HTMLElement | null;
    fileSlot?: HTMLElement | null;
    /** Moves the Settings page to another tab (the page owns the tabs). */
    onTab?: (tab: SchemaTab) => void;
}): import("react").JSX.Element;

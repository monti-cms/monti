import type { SchemaTab } from "../settings/tabs.js";
/** The schema file editor: edits `monti.schema.ts` on the development server, shows it read-only everywhere else. `tab` is the Settings tab being shown. */
export declare function SchemaSettings({ tab, actionsSlot }: {
    tab: SchemaTab;
    actionsSlot?: HTMLElement | null;
}): import("react").JSX.Element;

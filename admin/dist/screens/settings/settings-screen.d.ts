import { type SchemaTab } from "./tabs.js";
/**
 * The Settings page: its own header (title, one line about where it is saved, the pending changes and the review button) over a row of tabs, each its own address
 * (`<admin path>/settings/<tab>`). The tabs are the schema file editor's: site, languages, collections, file and admin. They share one draft.
 */
export declare function SettingsScreen({ tab }: {
    tab: SchemaTab;
}): import("react").JSX.Element;

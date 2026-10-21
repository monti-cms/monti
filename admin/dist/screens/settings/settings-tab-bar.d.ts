import { type Site } from "@monti-cms/core/site";
import { DATA_TAB, type SchemaTab } from "./tabs.js";
/**
 * The row of tabs under the Settings header: the schema file's tabs, then Data. The schema tabs change the address in place when `onSchemaTab` is given (the
 * schema screen keeps its draft that way); Data is a page of its own, so the link to it is a real navigation and leaving unsaved schema changes asks first.
 * From the Data page every tab is a plain link.
 */
export declare function SettingsTabBar({ site, active, onSchemaTab, }: {
    site: Pick<Site, "adminHref">;
    active: SchemaTab | typeof DATA_TAB;
    onSchemaTab?: (tab: SchemaTab) => void;
}): import("react").JSX.Element;

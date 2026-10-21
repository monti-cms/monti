import { type Site } from "@monti-cms/core/site";
import { type SchemaTab } from "./tabs.js";
/** The row of tabs under the Settings header. A tab changes the address in place when `onSchemaTab` is given, so the schema screen keeps its draft. */
export declare function SettingsTabBar({ site, active, onSchemaTab, }: {
    site: Pick<Site, "adminHref">;
    active: SchemaTab;
    onSchemaTab?: (tab: SchemaTab) => void;
}): import("react").JSX.Element;

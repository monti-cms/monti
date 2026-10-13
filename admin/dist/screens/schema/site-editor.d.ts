import type { SiteUrlState } from "@monti-cms/core/schema-edit";
import { type Obj } from "./schema-model.js";
/** The `site` settings of the file: name, home link, preview address, how the language shows in addresses, and other host names. The site URL is only shown. */
export declare function SiteEditor({ file, siteUrl, update, }: {
    file: Obj;
    siteUrl: SiteUrlState;
    update: (change: (file: Obj) => Obj) => void;
}): import("react").JSX.Element;

import { defineAdminPlugin } from "@monti-cms/admin/plugins";
import { SiteCalloutProvider } from "./provider";

/** The admin side of the site-callout plugin: registers the editing view of the `callout` block. */
export default defineAdminPlugin({ Provider: SiteCalloutProvider });

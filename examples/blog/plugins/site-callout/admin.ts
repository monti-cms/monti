
import { SiteCalloutProvider } from "./provider";
import { defineAdminPlugin } from "@monti-cms/admin";

/** The admin side of the site-callout plugin: registers the editing view of the `callout` block. */
export default defineAdminPlugin({ Provider: SiteCalloutProvider });

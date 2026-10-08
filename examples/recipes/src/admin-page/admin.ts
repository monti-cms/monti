import { defineAdminPlugin } from "@monti-cms/admin/plugins";
import { StatsPage } from "./stats-page";

/** The admin side: `pages` maps a path segment after the admin path to a client component. */
export default defineAdminPlugin({ pages: { "post-stats": StatsPage } });

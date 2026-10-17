import { defineAdminPlugin } from "@monti-cms/admin";
import { SEO_ADMIN_COMPONENTS } from "./admin/provider.js";
/** Admin UI side of the SEO extension. Registers the search preview, character count and hide switch. */
export default defineAdminPlugin({ components: SEO_ADMIN_COMPONENTS });

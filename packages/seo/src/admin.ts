import { defineAdminPlugin } from "@monti-cms/admin/plugins";
import { SeoAdminProvider } from "./admin/provider";

/** Admin UI side of the SEO extension. Registers the search preview, character count and hide switch. */
export default defineAdminPlugin({ Provider: SeoAdminProvider });

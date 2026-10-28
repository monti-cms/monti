import { defineAdminPlugin } from "@monti-cms/admin";
import { SEO_ADMIN_COMPONENTS } from "./admin/provider";

/** Admin UI side of the SEO extension. Registers the character counts and what an empty title, description or image reads in the properties list. */
export default defineAdminPlugin({ components: SEO_ADMIN_COMPONENTS });

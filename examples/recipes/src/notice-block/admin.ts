import { defineAdminPlugin } from "@monti-cms/admin/plugins";
import { NoticeProvider } from "./provider";

/** The admin side of the notice plugin: a provider that registers the editor view. */
export default defineAdminPlugin({ Provider: NoticeProvider });

import { defineAdminPlugin } from "@monti-cms/admin/plugins";
import { WordListProvider } from "./provider";

/** The admin side of the word-list plugin: a provider that wraps the admin UI and adds the checker to the editor. */
export default defineAdminPlugin({ Provider: WordListProvider });

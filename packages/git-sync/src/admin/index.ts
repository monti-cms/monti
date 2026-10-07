import { defineAdminPlugin } from "@monti-cms/admin/plugins";
import { GitSyncPage } from "./git-sync-page";
import { GitSyncAdminProvider } from "./provider";

/** Admin-screen side of the git-sync plugin: the Git sync screen (sync status and "Pull now", conflicts with a diff, token and webhook secret). */
export default defineAdminPlugin({ pages: { "git-sync": GitSyncPage }, Provider: GitSyncAdminProvider });

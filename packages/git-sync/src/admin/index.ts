import { defineAdminPlugin } from "@monti-cms/admin";
import { GitSyncPage } from "./git-sync-page";
import { gitSyncComponents } from "./provider";

/** Admin-screen side of the git-sync plugin: the Git sync screen (sync status and "Pull now", conflicts with a diff, token and webhook secret). */
export default defineAdminPlugin({ pages: { "git-sync": GitSyncPage }, components: gitSyncComponents });

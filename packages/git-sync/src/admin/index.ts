import { defineAdminPlugin } from "@monti-cms/admin";
import { GitSyncPage } from "./git-sync-page";
import { GitSyncStatus } from "./status-item";

/**
 * Admin-screen side of the git-sync plugin: the Git sync screen (sync status and "Pull now", conflicts with a diff, token and webhook secret), and its
 * state in the status bar.
 */
export default defineAdminPlugin({
	pages: { "git-sync": GitSyncPage },
	statusItems: { "git-sync": { align: "start", order: 100, Component: GitSyncStatus } },
});

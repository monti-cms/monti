import { defineAdminPlugin } from "@monti-cms/admin";
import { bareunComponents } from "./provider";
import { SpellingIssuesStatus } from "./status-item";

/** Admin UI side of the Bareun checker. Plugs the checker into the editor spell check, and its findings count into the status bar. */
export default defineAdminPlugin({
	components: bareunComponents,
	statusItems: { "spelling-issues": { align: "start", order: 40, Component: SpellingIssuesStatus } },
});

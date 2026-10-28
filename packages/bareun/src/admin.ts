import { defineAdminPlugin } from "@monti-cms/admin";
import { bareunComponents } from "./provider";
import { SpellingCell } from "./spelling-cell";

/** Admin UI side of the Bareun checker. Plugs the checker into the editor spell check, and its findings into the status bar. */
export default defineAdminPlugin({
	components: bareunComponents,
	statusCells: { spelling: SpellingCell },
});

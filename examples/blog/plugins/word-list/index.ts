import { definePlugin } from "@monti-cms/core";

/**
 * A plugin of this app that adds a spelling and grammar check to the editor: the example of how your own admin components are registered. There is no
 * separate admin file in `app/`: a plugin names its admin side (`admin`), and the admin loads it. The core ships no checker; this one only looks at a
 * banned-word list and runs in the browser. APIs that need a key attach through `remoteTextChecker({ url })` plus a server route (see "Text checking" in the
 * admin package README).
 *
 * It works with no arguments, like every plugin: `plugins: [wordList()]`.
 */
export const wordList = () =>
	definePlugin({
		name: "word-list",
		options: {},
		// Loaded by the admin only: the browser bundle reaches the plugin's client code through this one import.
		admin: () => import("./admin"),
	});

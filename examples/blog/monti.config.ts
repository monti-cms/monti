import path from "node:path";
import { assistant } from "@monti-cms/ai";
import { defineConfig, definePlugin, localFolderStorage, webhook } from "@monti-cms/core";
import schema from "./monti.schema";

// Media files in a folder on this machine, served by the admin API. A site on a host with no disk uses a storage plugin instead.
// `MONTI_STORAGE=off` is a site with no storage at all (the admin then says so where files would go).
const files =
	process.env.MONTI_STORAGE === "off"
		? []
		: [
				definePlugin({
					name: "files",
					storage: localFolderStorage({ dir: process.env.MONTI_FILES ?? path.join(process.cwd(), ".monti", "files") }),
				}),
			];

export default defineConfig({
	schema,
	database: process.env.DATABASE_URL,
	auth: { password: true },
	// The assistant (✦ in the admin): it works once a key of a model service is added under Tools › API keys.
	plugins: [...files, assistant()],
	// Code blocks: the two themes the site and the editor colour code with, and the languages the editor offers (doc 17).
	codeBlock: {
		themes: { light: "github-light", dark: "github-dark" },
		languages: ["ts", "tsx", "js", "json", "bash", "css", "html", "python", "sql", "yaml"],
	},
	// What else hears of a publish, a save, the trash: a search index, a deploy hook. A delivery that fails is in the admin's activity log.
	receivers: process.env.MONTI_WEBHOOK ? [webhook(process.env.MONTI_WEBHOOK)] : [],
});

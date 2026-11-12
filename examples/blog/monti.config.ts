import path from "node:path";
import { defineConfig, definePlugin, localFolderStorage } from "@monti-cms/core";
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
	plugins: files,
});

import path from "node:path";
import { assistant } from "@monti-cms/ai";
import { defineConfig, definePlugin, localFolderStorage, type MontiEvent, webhook } from "@monti-cms/core";
import { mdx } from "@monti-cms/mdx";
import { seo } from "@monti-cms/seo";
import { s3Storage } from "@monti-cms/storage-s3";
import schema from "./monti.schema";

// Media files: in S3 or R2 when the bucket's values are set (see `.env.example`), else in a folder on this machine, served by the admin
// API. `MONTI_STORAGE=off` runs the site with no storage at all, to see what the admin says where files would go.
const storage =
	process.env.MONTI_STORAGE === "off"
		? null
		: process.env.S3_BUCKET
			? s3Storage()
			: localFolderStorage({ dir: process.env.MONTI_FILES ?? path.join(process.cwd(), ".monti", "files") });

/** The address of this site, for the hooks it posts to itself. */
const site = process.env.SHOWCASE_URL ?? "http://localhost:3000";

export default defineConfig({
	schema,
	database: process.env.DATABASE_URL,
	auth: { password: true },
	// Code blocks: the two themes the site and the editor colour code with, and the languages the editor offers (doc 17).
	codeBlock: {
		themes: { light: "github-light", dark: "github-dark" },
		languages: ["ts", "tsx", "js", "json", "bash", "css", "html", "python"],
	},
	plugins: [
		...(storage ? [definePlugin({ name: "files", storage })] : []),
		// The assistant (✦ in the admin): it works once a model service's key is added under Tools › API keys.
		assistant(),
		// Search and share fields in a tab of every article, and their preview.
		seo(),
		// `.md` and `.mdx` files on a list's import, and "View as MDX" in the editor's ⋯.
		mdx(),
	],
	receivers: [
		// A hook that always fails (`app/hooks/[name]/route.ts` answers 503): what a failed delivery looks like in the activity log, the
		// sidebar and the banner, and what "send again" and "cancel" do. `SHOWCASE_BROKEN_HOOK=off` leaves it out.
		...(process.env.SHOWCASE_BROKEN_HOOK === "off"
			? []
			: [
					{
						...webhook(`${site}/hooks/broken`, { name: "broken" }),
						// Only an article on or off the site: a few failures to try, not one per save.
						accepts: (event: MontiEvent) =>
							event.collection === "article" && ["entry.published", "entry.unpublished"].includes(event.type),
					},
				]),
		// A hook that works: every event, posted to `MONTI_WEBHOOK` (`${site}/hooks/ok` keeps the last ones, at `/hooks/ok`).
		...(process.env.MONTI_WEBHOOK ? [webhook(process.env.MONTI_WEBHOOK, { name: "hook" })] : []),
	],
});

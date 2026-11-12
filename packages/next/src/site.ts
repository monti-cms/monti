import { accessSync, constants } from "node:fs";
import path from "node:path";
import {
	createReader,
	type Monti,
	type MontiConfig,
	type MontiEvent,
	openMonti,
	type Receiver,
	type SiteReader,
} from "@monti-cms/core";
import { revalidatePath } from "next/cache";

export type MontiSite = { monti: Monti; reader: SiteReader };

/** What the site shows changed: an entry went on or off it, or a file it shows did. A save alone changes nothing a visitor sees. */
const SHOWN = new Set(["entry.published", "entry.unpublished", "media.replaced", "media.trashed", "media.restored"]);

/**
 * Refreshes the site's cached pages after a change the site shows (doc 16). The whole site, not only the event's `paths`: another page may show
 * the entry too (a list, a post that names a category, a translation that follows its source), and a page that is never stale is worth more
 * than one that is rebuilt less often. A page is rebuilt when it is next visited, not here. It works inside a request (the admin API's route);
 * a delivery sent again from the command line has no Next around it and fails, to be sent again from the admin.
 */
export const cacheReceiver: Receiver = {
	destination: "plugin:next",
	accepts: (event: MontiEvent) => SHOWN.has(event.type),
	send: async () => {
		revalidatePath("/", "layout");
	},
};

/** Whether the schema file can be written: the dev server changes structure values by writing it (doc 12). */
function writable(root: string): boolean {
	try {
		accessSync(path.join(root, "monti.schema.ts"), constants.W_OK);
		return true;
	} catch {
		return false;
	}
}

/**
 * Whether this is the dev server (doc 16): `next dev`, with a schema file it can write. Everything else is the live site: structure values are
 * locked and nobody gets in without signing in.
 */
export const isDevServer = (root: string, env: Readonly<Record<string, string | undefined>> = process.env) =>
	env.NODE_ENV === "development" && writable(root);

const HELD = Symbol.for("monti.next.site");

/**
 * Opens the site's Monti and the reader its pages read with (doc 16). Once for a server: the dev server evaluates the module again on every
 * change, and each time would open another pool of database connections.
 */
export function openSite(config: MontiConfig, root = process.cwd()): MontiSite {
	const held = globalThis as { [HELD]?: MontiSite };
	if (held[HELD]) return held[HELD];
	const monti = openMonti(
		{ ...config, dev: config.dev ?? isDevServer(root), receivers: [...(config.receivers ?? []), cacheReceiver] },
		root,
	);
	const site = {
		monti,
		reader: createReader({
			db: monti.db,
			schema: () => monti.site.schema(),
			secret: monti.site.secret,
			storage: monti.site.storage,
		}),
	};
	held[HELD] = site;
	return site;
}

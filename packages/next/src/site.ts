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
import { loopbackProof } from "./dev-proof";

export type MontiSite = { monti: Monti; reader: SiteReader };

/**
 * The events that change nothing a visitor sees: a working copy saved, a file put in the library that no page uses yet. Every other event may
 * (an entry on or off the site, a live item's values, a file replaced, renamed, trashed or restored, and whatever a later feature adds), so the
 * list is of what is safe to skip, not of what to act on: an event nobody listed here refreshes the site.
 */
const UNSEEN = new Set(["entry.saved", "media.uploaded"]);

/**
 * Refreshes the site's cached pages after a change the site shows (doc 16). The whole site, not only the event's `paths`: another page may show
 * the entry too (a list, a post that names a category, a translation that follows its source), and a page that is never stale is worth more
 * than one that is rebuilt less often. A page is rebuilt when it is next visited, not here. It works inside a request (the admin API's route);
 * a delivery sent again from the command line has no Next around it and fails, to be sent again from the admin.
 *
 * The cache it marks is this server process's. A site run as several processes or machines needs a cache they share (a Next cache handler):
 * with the stock one, a page published through one process stays old on the others.
 */
export const cacheReceiver: Receiver = {
	destination: "plugin:next",
	accepts: (event: MontiEvent) => !UNSEEN.has(event.type),
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
type Held = { config: MontiConfig; root: string; site: MontiSite; proof: ReturnType<typeof loopbackProof> | null };

/**
 * Opens the site's Monti and the reader its pages read with (doc 16). Once for a server: the dev server evaluates the module again on every
 * change, and each time would open another pool of database connections. When the config itself changed (the schema file was edited, a setting
 * was), Monti is made again from it on the same pool, so the dev server runs what the files say now.
 */
export function openSite(config: MontiConfig, root = process.cwd()): MontiSite {
	const held = globalThis as { [HELD]?: Held };
	const before = held[HELD];
	if (before && before.config === config && before.root === root) return before.site;
	const dev = config.dev ?? isDevServer(root);
	// The proof that a browser is on this machine, for the dev server's sign-in bypass: one listener for the server's life.
	const proof = dev ? (before?.proof ?? loopbackProof()) : null;
	if (!dev) before?.proof?.close();
	const monti = openMonti(
		{ ...config, dev, devProof: proof, receivers: [...(config.receivers ?? []), cacheReceiver] },
		root,
		before ? { db: before.site.monti.db } : {},
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
	held[HELD] = { config, root, site, proof };
	return site;
}

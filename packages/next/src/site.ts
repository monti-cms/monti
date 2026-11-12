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
import { after } from "next/server";
import { loopbackProof } from "./dev-proof";

export type MontiSite = { monti: Monti; reader: SiteReader };

/**
 * The events that change nothing a visitor sees: a working copy saved, a file put in the library that no page uses yet, the admin's own values
 * saved (labels, layouts, the screen's language: doc 12). Every other event may (an entry on or off the site, a live item's values, a file
 * replaced, renamed, trashed or restored, a structure change, and whatever a later feature adds), so the list is of what is safe to skip, not of
 * what to act on: an event nobody listed here refreshes the site.
 */
const UNSEEN = new Set(["entry.saved", "media.uploaded", "settings.saved"]);

/** Longer than a page takes to draw: the second mark after a change comes this much later (see `refreshSite`). */
const SETTLE_MS = 2000;

/**
 * What the adapter does unless the site says otherwise (`openSite`'s `refresh`): it refreshes the site's cached pages after a change the site
 * shows (doc 16). The whole site, not only the event's `paths`: another page may show
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
	// A publish that answered is on the site: the pages are marked before the write answers, not after the response (doc 16, 16-3).
	beforeAnswer: true,
	// Every cached page is marked whatever the event: one send for a write, however many entries it published.
	oncePerWrite: true,
	send: async () => refreshSite(),
};

/**
 * Marks every cached page of the site to be drawn again: now, and once more a moment later. A page being drawn at the very moment of a change
 * read the site as it was before, and Next stamps it with the time it finished drawing, which is after the first mark: it would be kept as
 * fresh, old content and all, until the next change. The second mark comes after any such drawing has ended. A site that refreshes its pages its
 * own way (`openSite`'s `refresh`) may call this for the cases it does not narrow.
 */
export function refreshSite(): void {
	revalidatePath("/", "layout");
	after(async () => {
		await new Promise((done) => setTimeout(done, SETTLE_MS));
		revalidatePath("/", "layout");
	});
}

/**
 * Starts Monti's background sends after the response and keeps them going (the deliveries a visit to the admin starts, a write's webhooks):
 * Next's `after` runs the work once the response is sent and holds the function open until it ends, where a serverless host would otherwise end
 * it with the response and cut a send off before its result is written. Outside a request (a script that opens the site) there is nothing to
 * hold open and the work starts at once.
 */
function keepGoing(work: () => Promise<unknown>): void {
	try {
		// Started inside the callback, not before it: by Next's source (16.4.6) a `revalidatePath` called from work that began in the handler and
		// runs on after the handler has answered belongs neither to the handler's revalidations nor to an `after` callback's, and is dropped,
		// while the delivery would be marked sent. Work that starts here is the callback's own.
		after(work);
	} catch {
		// Not in a request: nothing to hold open, and the work starts now.
		void work();
	}
}

/**
 * What the site does when Monti says something a visitor sees has changed. Left out, every cached page is marked to be drawn again
 * (`refreshSite`): nothing stays old, at the cost of each page being drawn once more on its next visit. A site that knows which pages show what
 * gives its own function (it gets the event: its type, the entries, their public `paths`), or `false` to do nothing here and listen with a
 * receiver of its own.
 */
export type Refresh = false | ((event: MontiEvent) => void | Promise<void>);

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
type Held = {
	config: MontiConfig;
	root: string;
	refresh: Refresh | undefined;
	site: MontiSite;
	proof: ReturnType<typeof loopbackProof> | null;
};

/**
 * Opens the site's Monti and the reader its pages read with (doc 16). Once for a server: the dev server evaluates the module again on every
 * change, and each time would open another pool of database connections. When the config itself changed (the schema file was edited, a setting
 * was), Monti is made again from it on the same pool, so the dev server runs what the files say now.
 */
export function openSite(
	config: MontiConfig,
	{
		root = process.cwd(),
		refresh,
	}: { /** The site's folder, where `monti.schema.ts` is. */ root?: string; refresh?: Refresh } = {},
): MontiSite {
	const held = globalThis as { [HELD]?: Held };
	const before = held[HELD];
	if (before && before.config === config && before.root === root && before.refresh === refresh) return before.site;
	// The site's own way to refresh its pages takes the adapter's place; `false` leaves it to the site's receivers.
	const receiver: Receiver[] =
		refresh === false
			? []
			: [
					// A site's own refresh looks at each event (its entries, its paths): it gets every one.
					refresh
						? { ...cacheReceiver, oncePerWrite: false, send: async (event) => void (await refresh(event)) }
						: cacheReceiver,
				];
	const dev = config.dev ?? isDevServer(root);
	// The proof that a browser is on this machine, for the dev server's sign-in bypass: one listener for the server's life.
	const proof = dev ? (before?.proof ?? loopbackProof()) : null;
	if (!dev) before?.proof?.close();
	const monti = openMonti(
		{ ...config, dev, devProof: proof, receivers: [...(config.receivers ?? []), ...receiver] },
		root,
		{ ...(before ? { db: before.site.monti.db } : {}), waitUntil: keepGoing },
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
	held[HELD] = { config, root, refresh, site, proof };
	return site;
}

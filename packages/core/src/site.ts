import type { DevProof } from "./auth/dev-bypass";
import type { AuthSettings } from "./auth/operations";
import { type BlockKit, createBlockKit } from "./body/blocks";
import type { PublishCheck } from "./entries/tasks";
import type { KeyService } from "./keys/services";
import type { Storage } from "./media/storage";
import {
	type BeforeSave,
	type Importer,
	type KeySlot,
	type NamedFieldSet,
	type PluginTab,
	pluginTabsOf,
	type TextCheck,
	type ToolPage,
	withPluginFields,
} from "./plugins/define";
import type { Schema } from "./schema/define";
import type { SchemaFiles } from "./schema/files";

/** A plugin as the site knows it: its name and what it adds besides operations. */
export type SitePlugin = {
	name: string;
	/** Its name as a person reads it; the code name when it gives none. */
	label: string;
	keys: readonly KeySlot[];
	textCheck: TextCheck | null;
	beforeSave: BeforeSave | null;
	toolPages: readonly ToolPage[];
	importers: readonly Importer[];
	/** What it adds, by kind, for the plugin list (`plugins.list`). */
	adds: readonly string[];
};

/** What operations know about the site they run in. */
export type Site = {
	/**
	 * The schema the site runs with: `monti.schema.ts` as last applied, and the value fields its plugins add (doc 14). Everything that
	 * reads or writes entries goes by this one.
	 */
	schema(): Schema;
	/** `monti.schema.ts` alone, without the plugins' fields: what the structure operations plan, compare and write. */
	fileSchema(): Schema;
	/** Replaces the file's schema after `schema.apply` wrote the file, until the host reloads the file itself. */
	setSchema(schema: Schema): void;
	/** The plugins' tabs of a collection's property panel, with their fields (doc 01, the locked tab). */
	pluginTabs(collection: string): PluginTab[];
	/** The plugins' field sets, as they were given. */
	fieldSets: readonly NamedFieldSet[];
	plugins: readonly SitePlugin[];
	/** The way to `monti.schema.ts` and the change files: only on the dev server; `null` on the live site, where structure values are locked. */
	files: SchemaFiles | null;
	/** Checks plugins add to the publish to-do list (doc 02). */
	publishChecks: readonly PublishCheck[];
	/** `MONTI_SECRET`: signs preview links and seals service keys. Without it there is no preview and no key can be stored. */
	secret: string | null;
	/** The services a key can be for: the AI services the core knows and the plugins' (doc 14). */
	keyServices: readonly KeyService[];
	/** The `fetch` the server calls other services with (a key's check). Tests replace it. */
	fetch: typeof globalThis.fetch;
	/** The body blocks and marks: the core's, the site's and its plugins' (doc 03). */
	kit: BlockKit;
	/** The ways to sign in (doc 15). */
	auth: AuthSettings;
	/** How a browser proves it runs on this machine, for the dev server's sign-in bypass (doc 16). The adapter brings it; without one nobody is let in. */
	devProof: DevProof | null;
	/** Where media files are, from a plugin (doc 09). Without one the library says there is no storage and takes no file. */
	storage: Storage | null;
};

export function createSite(
	schema: Schema,
	files: SchemaFiles | null,
	extra: {
		publishChecks?: readonly PublishCheck[];
		secret?: string | null;
		kit?: BlockKit;
		auth?: AuthSettings;
		devProof?: DevProof | null;
		storage?: Storage | null;
		keyServices?: readonly KeyService[];
		fetch?: typeof globalThis.fetch;
		fieldSets?: readonly NamedFieldSet[];
		plugins?: readonly SitePlugin[];
	} = {},
): Site {
	const fieldSets = extra.fieldSets ?? [];
	let file = schema;
	let current = withPluginFields(file, fieldSets);
	return {
		schema: () => current,
		fileSchema: () => file,
		setSchema: (next) => {
			file = next;
			current = withPluginFields(file, fieldSets);
		},
		pluginTabs: (collection) => pluginTabsOf(file, fieldSets, collection),
		fieldSets,
		plugins: extra.plugins ?? [],
		files,
		publishChecks: extra.publishChecks ?? [],
		// An empty secret is none: a link signed or a key sealed with "" is signed and sealed for anyone (MONTI_SECRET="" in a deploy's settings).
		secret: extra.secret?.trim() ? extra.secret : null,
		kit: extra.kit ?? createBlockKit([], []),
		auth: extra.auth ?? { password: false, github: null, devBypass: true },
		devProof: extra.devProof ?? null,
		storage: extra.storage ?? null,
		keyServices: extra.keyServices ?? [],
		fetch: extra.fetch ?? ((...args) => globalThis.fetch(...args)),
	};
}

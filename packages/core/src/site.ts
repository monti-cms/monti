import type { AuthSettings } from "./auth/operations";
import { type BlockKit, createBlockKit } from "./body/blocks";
import type { PublishCheck } from "./entries/tasks";
import type { Storage } from "./media/storage";
import type { Schema } from "./schema/define";
import type { SchemaFiles } from "./schema/files";

/** What operations know about the site they run in. */
export type Site = {
	/** The schema the site runs with: `monti.schema.ts` as last applied. */
	schema(): Schema;
	/** Replaces it after `schema.apply` wrote the file, until the host reloads the file itself. */
	setSchema(schema: Schema): void;
	/** The way to `monti.schema.ts` and the change files: only on the dev server; `null` on the live site, where structure values are locked. */
	files: SchemaFiles | null;
	/** Checks plugins add to the publish to-do list (doc 02). */
	publishChecks: readonly PublishCheck[];
	/** `MONTI_SECRET`: signs preview links. Without it there is no preview. */
	secret: string | null;
	/** The body blocks and marks: the core's, the site's and its plugins' (doc 03). */
	kit: BlockKit;
	/** The ways to sign in (doc 15). */
	auth: AuthSettings;
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
		storage?: Storage | null;
	} = {},
): Site {
	let current = schema;
	return {
		schema: () => current,
		setSchema: (next) => {
			current = next;
		},
		files,
		publishChecks: extra.publishChecks ?? [],
		secret: extra.secret ?? null,
		kit: extra.kit ?? createBlockKit([], []),
		auth: extra.auth ?? { password: false, github: null, devBypass: true },
		storage: extra.storage ?? null,
	};
}

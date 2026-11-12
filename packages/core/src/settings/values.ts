import type { Kysely, Transaction } from "kysely";
import { z } from "zod";
import type { Database } from "../db/schema";
import { defineRecordKind } from "../records";

type Db = Kysely<Database> | Transaction<Database>;

/** The languages the admin screen is written in. */
export const ADMIN_LANGUAGES = ["ko", "en"] as const;
export type AdminLanguage = (typeof ADMIN_LANGUAGES)[number];

/** The site's admin values of the settings screen (doc 12): what only the admin and the assistant read, so they change on the live site too. */
export const SiteValues = z.object({
	/** Over the sidebar and on the sign-in screen. */
	name: z.string().trim().max(80).optional(),
	/** How the site writes: the tone and rules the assistant follows (doc 10). */
	writing: z.string().max(4000).optional(),
});
export type SiteValues = z.infer<typeof SiteValues>;

/** The admin's own preferences (doc 12): saved the moment they are picked, with no draft. */
export const AdminPreferences = z.object({
	language: z.enum(ADMIN_LANGUAGES).optional(),
	/** Body templates: off hides them from the "/" menu and the tools (doc 03). They are not deleted. */
	templates: z.boolean().optional(),
});
export type AdminPreferences = z.infer<typeof AdminPreferences>;

/** The two rows of `monti_settings`. */
export type SettingsId = "site" | "admin";

export async function readSettings(
	db: Db,
	id: SettingsId,
): Promise<{ values: Record<string, unknown>; version: number }> {
	const row = await db
		.selectFrom("monti_settings")
		.select(["values", "version"])
		.where("id", "=", id)
		.executeTakeFirst();
	// A row never saved reads as empty at version 0, so a screen and a proposal can name its version before it exists.
	return row ?? { values: {}, version: 0 };
}

export async function writeSettings(db: Db, id: SettingsId, values: Record<string, unknown>): Promise<void> {
	await db
		.insertInto("monti_settings")
		.values({ id, values: JSON.stringify(values) })
		.onConflict((conflict) =>
			conflict.column("id").doUpdateSet((eb) => ({
				values: JSON.stringify(values),
				version: eb("monti_settings.version", "+", 1),
			})),
		)
		.execute();
}

/** What the sign-in screen and the frame show before any screen reads the settings: the site's name and the admin's language, `null` until saved. */
export async function siteFace(db: Db): Promise<{ name: string | null; language: AdminLanguage | null }> {
	const [site, admin] = await Promise.all([readSettings(db, "site"), readSettings(db, "admin")]);
	return {
		name: SiteValues.parse(site.values).name || null,
		language: AdminPreferences.parse(admin.values).language ?? null,
	};
}

/**
 * The settings rows as records: their versions guard two saves over each other, and an undo puts the old values back. A row never saved is the empty
 * record at version 0.
 */
export const settingsRecord = defineRecordKind({
	kind: "settings",
	async load(db, ids) {
		const wanted = ids.filter((id): id is SettingsId => id === "site" || id === "admin");
		const rows = await Promise.all(wanted.map(async (id) => ({ id, ...(await readSettings(db, id)) })));
		return rows.map((row) => ({ id: row.id, version: row.version, data: row.values }));
	},
	async restore(db, id, data) {
		if (id !== "site" && id !== "admin") return;
		await writeSettings(db, id, (data ?? {}) as Record<string, unknown>);
	},
});

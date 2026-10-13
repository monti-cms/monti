import type { Site } from "@monti-cms/core/client";
import type { Cms, PluginMigration, PluginStorage } from "@monti-cms/core/plugin/server";
import { z } from "zod";
import { legacyFeatureOverride } from "./actions";
import { AI_COLLECTIONS } from "./collections";
import { AI_PLUGIN_NAME } from "./plugin-name";
import { aiSecrets } from "./secret";
import { settingsMessages } from "./settings.messages";

/**
 * Tables the AI plugin kept in the database itself, before it used the plugin storage API (`cms.storage("ai")`), and where their rows go now.
 * Their names stay the collection names, so an old row `key` or `id` is the new item key.
 */
const LEGACY_TABLES = [
	{ table: "ai_action_overrides", collection: AI_COLLECTIONS.actionOverrides, keyColumn: "key" },
	{ table: "ai_custom_actions", collection: AI_COLLECTIONS.customActions, keyColumn: "key" },
	{ table: "ai_settings", collection: AI_COLLECTIONS.settings, keyColumn: "id" },
] as const;

const asDate = (value: unknown): Date | undefined => (value instanceof Date ? value : undefined);

/** Copies the rows of the three legacy tables into the storage, keeping each row's value, version and dates. A table that does not exist has nothing to copy. */
async function importLegacyTables(migration: PluginMigration): Promise<void> {
	for (const { table, collection, keyColumn } of LEGACY_TABLES) {
		for (const row of (await migration.readLegacyTable(table)) ?? []) {
			const key = row[keyColumn];
			if (typeof key !== "string") continue;
			const updatedAt = asDate(row.updated_at);
			await migration.importItem(collection, {
				key,
				value: row.value,
				version: typeof row.version === "number" ? row.version : 1,
				createdAt: asDate(row.created_at) ?? updatedAt,
				updatedAt,
			});
		}
	}
}

/**
 * Moves the edited values of the oldest AI actions table (`ai_features`, from when AI lived in the core) into per-action edited values, once.
 * The old table is not dropped. An edited value that is already in the storage is kept.
 */
async function importLegacyFeatures(migration: PluginMigration, site: Site): Promise<void> {
	const overrides = await migration.readLegacyTable("ai_features");
	for (const row of overrides ?? []) {
		const builtin = row.builtin;
		if (typeof builtin !== "string") continue;
		const value = legacyFeatureOverride(site, builtin, row.spec);
		if (!value || Object.keys(value).length === 0) continue;
		await migration.importItem(AI_COLLECTIONS.actionOverrides, { key: builtin, value });
	}
}

/** A connection as it was stored before keys moved to the central store: the key is ciphertext in the connection itself. */
interface OldProvider {
	id: string;
	name: string;
	kind: "chat" | "decisions";
	url: string;
	apiKey: string | null;
	defaultModel: string;
}

const oldProviderSchema = z.object({
	id: z.string(),
	name: z.string(),
	kind: z.enum(["chat", "decisions"]),
	url: z.string().default(""),
	apiKey: z.string().nullable().default(null),
	defaultModel: z.string().default(""),
});

/** The shape from before connections were kept one by one (one pair of generation and decision connections). */
const pairSchema = z.object({
	generate: z.object({ baseUrl: z.string(), apiKey: z.string().nullable(), smallModel: z.string() }),
	decide: z.object({ url: z.string(), apiKey: z.string().nullable(), shareKey: z.boolean(), model: z.string() }),
});

/** The connections of a stored settings row in either old shape. `null` when the row has keys in none of them (nothing to move). */
function oldProviders(site: Site, value: unknown): OldProvider[] | null {
	const t = site.createTranslator(settingsMessages);
	const pair = pairSchema.safeParse(value);
	if (pair.success) {
		const { generate, decide } = pair.data;
		return [
			{
				id: "legacy-chat",
				name: t("legacyGenerate"),
				kind: "chat" as const,
				url: generate.baseUrl,
				apiKey: generate.apiKey,
				defaultModel: generate.smallModel,
			},
			{
				id: "legacy-decisions",
				name: t("legacyDecide"),
				kind: "decisions" as const,
				url: decide.url,
				apiKey: decide.shareKey ? generate.apiKey : decide.apiKey,
				defaultModel: decide.model,
			},
		].filter((provider) => provider.url || provider.defaultModel);
	}
	const raw = (value as { providers?: unknown } | null)?.providers;
	// The current shape holds key ids; only a row that still has the `apiKey` ciphertext has anything to move.
	if (!Array.isArray(raw) || !raw.some((item) => item && typeof item === "object" && "apiKey" in item)) return null;
	const parsed = z.array(oldProviderSchema).safeParse(raw);
	return parsed.success ? parsed.data : null;
}

/**
 * Moves the service keys stored inside the AI connections into the central API key store, once: each distinct key becomes a key named after the first connection
 * that uses it (`Name 2` if taken), connections that shared one key keep sharing it, and the connection keeps only the key's id. A key that cannot be decrypted
 * any more (the server `secret` changed without `previousSecrets`) cannot be moved: its connection is left without a key and needs one entered again.
 * Safe to repeat: a row that already holds ids is left alone, and a value already in the store is reused instead of added again.
 */
export async function moveKeysToStore(storage: PluginStorage, cms: Cms): Promise<number> {
	const settings = storage.collection(AI_COLLECTIONS.settings);
	const row = await settings.get("default");
	if (!row) return 0;
	const providers = oldProviders(cms.site, row.value);
	if (!providers) return 0;

	const secrets = aiSecrets(cms);
	const byValue = new Map<string, string>();
	const existing = await cms.apiKeys.list();
	for (const key of existing) {
		const value = await cms.apiKeys.read(key.id);
		if (value !== null) byValue.set(value, key.id);
	}
	let moved = 0;
	const next = [];
	for (const provider of providers) {
		let keyId: string | null = null;
		if (provider.apiKey !== null) {
			const plain = secrets.decrypt(provider.apiKey);
			if (plain === null) {
				console.warn(
					`[ai] the key of the connection "${provider.name}" cannot be decrypted, so it was not moved; enter it again in the admin`,
				);
			} else {
				keyId = byValue.get(plain) ?? null;
				if (!keyId) {
					keyId = (await cms.apiKeys.addNamed({ baseName: provider.name, value: plain })).id;
					byValue.set(plain, keyId);
					moved++;
				}
			}
		}
		next.push({
			id: provider.id,
			name: provider.name,
			kind: provider.kind,
			url: provider.url,
			keyId,
			defaultModel: provider.defaultModel,
		});
	}
	try {
		await settings.set("default", { providers: next }, { expectedVersion: row.version });
	} catch (error) {
		// A save of the connections raced with this and wrote the new shape already.
		if ((error as { code?: unknown }).code === "conflict") return 0;
		throw error;
	}
	const t = cms.site.createTranslator(settingsMessages);
	await cms.apiKeys.setUses(
		AI_PLUGIN_NAME,
		next.flatMap((provider) =>
			provider.keyId
				? [{ slot: `connection:${provider.id}`, keyId: provider.keyId, label: t("keyUse", { name: provider.name }) }]
				: [],
		),
	);
	return moved;
}

/**
 * AI plugin migration. `monti db:migrate` calls it after the core tables, with the plugin's storage. Safe to call repeatedly.
 *
 * Data from before the storage API is moved once: the three tables the plugin used to create itself (`ai_action_overrides`, `ai_custom_actions`, `ai_settings`)
 * are copied into the plugin's collections with their versions and dates, and the old tables stay where they are, untouched.
 * Service keys stored inside the connections are then moved into the central API key store.
 */
export async function migrateAi(storage: PluginStorage, cms: Cms): Promise<void> {
	await storage.once("import_legacy_tables", importLegacyTables);

	// The name of this step before the storage API was `migrate_ai_features_to_actions` (recorded without the plugin's name). Where that record exists, the work is done.
	await storage.once("ai_features_to_actions", (migration) => importLegacyFeatures(migration, cms.site), {
		legacyNames: ["migrate_ai_features_to_actions"],
	});

	await moveKeysToStore(storage, cms);
}

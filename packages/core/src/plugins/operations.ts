import { type Kysely, sql, type Transaction } from "kysely";
import { z } from "zod";
import type { Database } from "../db/schema";
import { CheckError, ConflictError } from "../errors";
import {
	address,
	ask,
	ending,
	type OpenKey,
	opened,
	type SlotKey,
	secretOf,
	slotKeyId,
	slotKeys,
} from "../keys/operations";
import { seal } from "../keys/seal";
import { defineOperation, type OperationContext } from "../operation";
import { lockRecords } from "../records";
import type { SitePlugin } from "../site";
import type { TextFinding } from "./define";

type Db = Kysely<Database> | Transaction<Database>;

/** A plugin as the plugin list tells of it. */
export type PluginRow = {
	name: string;
	label: string;
	/** What it adds, by kind: `operations`, `blocks`, `fields`, `columns`, `publishChecks`, `textCheck`, `receivers`, `keys`… */
	adds: readonly string[];
	keys: { id: string; label: string; service: string; filled: boolean }[];
	toolPages: { id: string; label: string }[];
	textCheck: { label: string; locales: readonly string[] | null } | null;
	importers: { id: string; label: string; extensions: readonly string[] }[];
};

/** What one plugin's text check found. `failed` when the check itself did not work: the cell then says so, and lists nothing. */
export type TextCheckResult = { plugin: string; label: string; findings: TextFinding[]; failed: boolean };

const slotOf = (ctx: OperationContext, pluginName: string, slotId: string) => {
	const plugin = ctx.site.plugins.find((candidate) => candidate.name === pluginName);
	const slot = plugin?.keys.find((candidate) => candidate.id === slotId);
	if (!plugin || !slot) throw new CheckError({ key: "plugins.unknownSlot" });
	const service = ctx.site.keyServices.find((candidate) => candidate.id === slot.service);
	// The site is built only with slots whose service it has, so this is a slot of a site put together by hand.
	if (!service) throw new CheckError({ key: "keys.unknownService" });
	return { plugin, slot, service };
};

/** The findings a check may give: in a block it was handed, over words that block has, with words to put there. Anything else is dropped. */
function sound(found: unknown, blocks: readonly { id: string; text: string }[]): TextFinding[] {
	if (!Array.isArray(found)) return [];
	const lengths = new Map(blocks.map((block) => [block.id, block.text.length]));
	return found.flatMap((one): TextFinding[] => {
		if (typeof one !== "object" || one === null) return [];
		const { block, from, to, replacement, note } = one as Record<string, unknown>;
		const length = typeof block === "string" ? lengths.get(block) : undefined;
		if (
			typeof block !== "string" ||
			length === undefined ||
			!Number.isInteger(from) ||
			!Number.isInteger(to) ||
			typeof replacement !== "string" ||
			(from as number) < 0 ||
			(to as number) <= (from as number) ||
			(to as number) > length
		)
			return [];
		return [
			{
				block,
				from: from as number,
				to: to as number,
				replacement,
				...(typeof note === "string" && note !== "" ? { note } : {}),
			},
		];
	});
}

const reads = (plugin: SitePlugin, locale: string) =>
	plugin.textCheck !== null && (plugin.textCheck.locales === undefined || plugin.textCheck.locales.includes(locale));

export const pluginOperations = [
	defineOperation({
		name: "plugins.list",
		kind: "read",
		description:
			"The plugins the site's code adds: each one's name, what it adds (operations, blocks, fields, list columns, publish checks, a text check, receivers, key slots, tool pages, import formats), and whether its key slots are filled. Plugins are added and removed in the site's code, never here.",
		input: z.object({}),
		async run(_input, ctx): Promise<{ plugins: PluginRow[] }> {
			const filled = new Set((await slotKeys(ctx.db)).map((key) => key.id));
			return {
				plugins: ctx.site.plugins.map((plugin) => ({
					name: plugin.name,
					label: plugin.label,
					adds: plugin.adds,
					keys: plugin.keys.map((slot) => ({
						id: slot.id,
						label: slot.label,
						service: slot.service,
						filled: filled.has(slotKeyId(plugin.name, slot.id)),
					})),
					toolPages: plugin.toolPages.map((page) => ({ id: page.id, label: page.label })),
					textCheck: plugin.textCheck
						? { label: plugin.textCheck.label, locales: plugin.textCheck.locales ?? null }
						: null,
					importers: plugin.importers.map((importer) => ({
						id: importer.id,
						label: importer.label,
						extensions: importer.extensions,
					})),
				})),
			};
		},
	}),
	defineOperation({
		name: "plugins.setKey",
		kind: "write",
		humanOnly: true,
		secretInputs: ["secret"],
		description:
			"Put a key in a plugin's key slot, replace the one there, or (with `secret: null`) take it out. The slot's service is asked once whether it takes the key; a key it refuses is not stored. Only a person does it: it needs the key itself.",
		input: z.object({
			plugin: z.string(),
			slot: z.string(),
			/** The key itself; `null` takes the slot's key out. */
			secret: z.string().trim().nullable(),
			/** The service's address, for a service that asks for one. */
			baseUrl: z.string().optional(),
		}),
		// The service is asked before the write's transaction opens, as for any key (doc 14).
		async prepare(input, ctx) {
			const { plugin, slot, service } = slotOf(ctx, input.plugin, input.slot);
			const id = slotKeyId(plugin.name, slot.id);
			const stored = await ctx.db.selectFrom("api_keys").select("version").where("id", "=", id).executeTakeFirst();
			if (input.secret === null) return { id, version: stored?.version ?? null, label: plugin.label, set: null };
			const secret = secretOf(ctx);
			const baseUrl = service.address ? address(input.baseUrl) : null;
			const models = await ask(ctx, service, input.secret, baseUrl);
			return {
				id,
				version: stored?.version ?? null,
				label: plugin.label,
				set: {
					service: service.id,
					baseUrl,
					models,
					sealed: await seal(secret, input.secret, { id, service: service.id, baseUrl }),
					last4: ending(input.secret),
				},
			};
		},
		async run(_input, ctx, asked) {
			// One change of a slot at a time: the row is looked at again once the slot is held.
			await lockRecords(ctx.db, [{ kind: "key", id: asked.id }]);
			const stored = await ctx.db
				.selectFrom("api_keys")
				.select("version")
				.where("id", "=", asked.id)
				.executeTakeFirst();
			// What the service was asked about is put over what was there when it was asked, or nothing is written.
			if ((stored?.version ?? null) !== asked.version)
				throw new ConflictError([
					{ ref: { kind: "key", id: asked.id }, expected: asked.version ?? 0, actual: stored?.version ?? null },
				]);
			if (asked.set === null) {
				if (!stored) throw new CheckError({ key: "plugins.slotEmpty" });
				await ctx.db.deleteFrom("api_keys").where("id", "=", asked.id).execute();
				return { plugin: asked.label, last4: "", did: "removed" as const };
			}
			const row = {
				service: asked.set.service,
				base_url: asked.set.baseUrl,
				secret: asked.set.sealed,
				last4: asked.set.last4,
				models: JSON.stringify(asked.set.models),
				models_at: ctx.now(),
				models_failed_at: null,
			};
			if (stored)
				await ctx.db
					.updateTable("api_keys")
					.set((eb) => ({ ...row, version: eb("version", "+", 1) }))
					.where("id", "=", asked.id)
					.execute();
			else {
				// The row's name is the slot's own id: a slot has no name a person gives, and names are unique.
				await ctx.db
					.insertInto("api_keys")
					.values({ id: asked.id, name: asked.id, ...row, created_at: sql<Date>`${ctx.now()}::timestamptz` })
					.execute();
				ctx.created({ kind: "key", id: asked.id });
			}
			return { plugin: asked.label, last4: asked.set.last4, did: stored ? ("replaced" as const) : ("set" as const) };
		},
		log: "settings",
		where: () => ({ key: "activity.where.keys" }),
		summary: (_input, output) => ({
			key: output.did === "removed" ? "plugins.setKey.removed" : "plugins.setKey.set",
			values: { plugin: output.plugin },
		}),
	}),
	defineOperation({
		name: "plugins.checkText",
		kind: "read",
		description:
			"Run the plugins' text checks (spelling) over blocks of text in one language: for each plugin that reads that language, the places to change (block, from and to as offsets in the block's text) and the words to put there. Nothing is changed.",
		input: z.object({
			collection: z.string(),
			locale: z.string(),
			blocks: z.array(z.object({ id: z.string(), text: z.string() })).max(2000),
		}),
		async run(input, ctx): Promise<{ checks: TextCheckResult[] }> {
			const checks = await Promise.all(
				ctx.site.plugins
					.filter((plugin) => reads(plugin, input.locale))
					.map(async (plugin): Promise<TextCheckResult> => {
						const check = plugin.textCheck;
						const base = { plugin: plugin.name, label: check?.label ?? plugin.label };
						try {
							const found = await check?.check(input.blocks, { collection: input.collection, locale: input.locale });
							return { ...base, findings: sound(found, input.blocks), failed: false };
						} catch (error) {
							// The plugin's own failure is the server's to read; the screen is told only that the check did not work.
							console.error(`Monti: the text check of plugin ${plugin.name} failed:`, error);
							return { ...base, findings: [], failed: true };
						}
					}),
			);
			return { checks };
		},
	}),
];

/** The key in a plugin's slot, opened with the server's secret; `null` while the slot is empty or the secret does not open it. */
export async function openSlotKey(
	db: Db,
	secret: string | null,
	plugin: string,
	slot: string,
): Promise<OpenKey | null> {
	if (secret === null) return null;
	const id = slotKeyId(plugin, slot);
	const key = (await db.selectFrom("api_keys").selectAll().where("id", "=", id).executeTakeFirst()) as
		| SlotKey
		| undefined;
	const plain = key ? await opened(secret, key) : null;
	return key && plain !== null
		? { id: key.id, service: key.service, name: key.name, secret: plain, baseUrl: key.base_url }
		: null;
}

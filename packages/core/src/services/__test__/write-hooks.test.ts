import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { contentCollection, recordCollection, requiredMetadata, secondLocale } from "../../../test/any-site";
import { testSite } from "../../../test/site";
import type { Collection } from "../../core/collections";
import { type ContentChange, type ContentStore, type Entry, withEventDispatch } from "../../core/store";
import { seedEntry } from "../../core/store/__test__/seed";
import { STORED_DOCUMENT_VERSION, type StoredDocument } from "../../doc/stored-document";
import { paragraphsFormat } from "../../format/__test__/paragraphs-format";
import { createFormatRegistry } from "../../format/registry";
import {
	closeGlobalPool,
	createContentStore,
	createIsolatedTestPool,
	dropIsolatedTestPool,
	migrateContentStore,
} from "../../testing";
import { type BulkItemResult, createBulkService } from "../bulk-service";
import { createContentService } from "../content-service";
import { createEventDispatcher } from "../events";
import type { HookSource, WriteOperation } from "../hooks";
import type { ServiceInput } from "../types";

/**
 * Hook contract tests, against real PostgreSQL and the production write paths (content service and bulk service on a content store).
 * Each test is one rule of the contract written in the core README ("Hook contract").
 */

describe("write hook contract", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ContentStore;
	let service: ReturnType<typeof createContentService<Entry>>;
	let bulk: ReturnType<typeof createBulkService<Entry>>;
	let sources: HookSource[] = [];
	let changes: ContentChange[] = [];
	let afterCommitFails = false;
	let sequence = 0;
	const unique = (prefix: string) => `${prefix}-${++sequence}`;
	const targets = new Map<Collection, string>();

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { site: testSite, schema: schemaName });
		const raw = createContentStore(pool, { site: testSite, schema: schemaName });
		// The delivery of `afterCommit` as the instance does it, with a subscriber that records what it gets. Retries are never due, so a failed delivery
		// of one test cannot show up in the next.
		const dispatcher = createEventDispatcher({
			store: () => raw,
			backoffMs: () => 365 * 24 * 3600_000,
			subscribers: async () => [
				{
					name: "test",
					handler: (change) => {
						if (afterCommitFails) throw new Error("afterCommit is down");
						changes.push(change);
					},
				},
			],
		});
		store = withEventDispatch(raw, dispatcher.dispatchEntry);
		const hooks = () => sources;
		const formats = async () => createFormatRegistry([paragraphsFormat]);
		service = createContentService<Entry>(store, { site: testSite, hooks, formats });
		bulk = createBulkService<Entry>(store, { site: testSite, hooks, formats });
		vi.spyOn(console, "error").mockImplementation(() => undefined);
	});

	beforeEach(() => {
		sources = [];
		changes = [];
		afterCommitFails = false;
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	const relationTarget = async (to: Collection): Promise<string> => {
		const known = targets.get(to);
		if (known) return known;
		// A target is made with no hooks registered; the test's own hooks are put back after.
		const registered = sources;
		sources = [];
		try {
			const draft = await service.createDraft({
				collection: to,
				slug: unique(to),
				metadata: await requiredMetadata(to, unique(`target ${to}`), relationTarget),
				format: "paragraphs",
				body: "Body",
			});
			targets.set(to, draft.id);
			return draft.id;
		} finally {
			sources = registered;
		}
	};

	/** Input for a new post. What making its relation targets reported to afterCommit is not part of the test. */
	const postInput = async (title: string, text = "Body") => {
		const metadata = await requiredMetadata(contentCollection, title, relationTarget);
		changes = [];
		return {
			collection: contentCollection,
			slug: unique("post"),
			metadata,
			format: "paragraphs",
			body: text,
		} as unknown as ServiceInput;
	};

	/** Throws a bulk item's failure as the error a single write would throw. */
	const assertBulkItemOk = (result: BulkItemResult | undefined) => {
		if (!result || result.ok) return;
		throw Object.assign(new Error("bulk item failed"), { code: result.error, issues: result.issues });
	};

	/** A draft that can be published, made with no hooks registered. */
	const newPost = async (title = "Post", text = "Body"): Promise<Entry> => {
		const registered = sources;
		sources = [];
		try {
			const draft = await service.createDraft(await postInput(title, text));
			changes = [];
			return draft;
		} finally {
			sources = registered;
		}
	};

	const saveInput = (entry: Entry, metadata: Record<string, unknown> = entry.working.metadata) =>
		({
			collection: entry.collection,
			slug: entry.workingSlug,
			metadata,
			doc: entry.working.doc,
			expectedVersion: entry.version,
		}) as never;

	const entryCount = async () =>
		Number((await pool.query(`SELECT count(*) FROM "${schemaName}".entries`)).rows[0].count);

	const server = (hooks: HookSource["hooks"]): HookSource[] => [{ owner: "server", hooks }];

	describe("transformed data still goes through core", () => {
		it("stores what the transform returns", async () => {
			sources = server({
				transform: ({ metadata, doc }) => ({
					metadata: { ...metadata, title: String(metadata.title).toUpperCase() },
					doc,
				}),
			});
			const created = await service.createDraft(await postInput("shouting"));
			expect(created.working.metadata.title).toBe("SHOUTING");
			expect((await store.getEntry(created.id)).working.metadata.title).toBe("SHOUTING");
		});

		it("gets the address of the entry, and may change it", async () => {
			const seen: (string | null)[] = [];
			sources = server({
				transform: ({ slug, metadata, doc }) => {
					seen.push(slug);
					return { metadata, doc, slug: slug?.toUpperCase() };
				},
				validate: ({ slug }) => {
					seen.push(slug);
				},
			});
			const input = await postInput("Slug hook");
			const created = await service.createDraft({ ...input, slug: "mixed-case" } as ServiceInput);
			// The transform saw what was sent, the validation what core prepared from what the transform returned.
			expect(seen).toEqual(["mixed-case", "MIXED-CASE"]);
			expect(created.workingSlug).toBe("MIXED-CASE");
		});

		it("validates it: a key the schema does not have is rejected and nothing is stored", async () => {
			sources = server({ transform: ({ metadata, doc }) => ({ metadata: { ...metadata, notAField: "x" }, doc }) });
			const before = await entryCount();
			await expect(service.createDraft(await postInput("Bad"))).rejects.toMatchObject({ code: "invalid_metadata_key" });
			expect(await entryCount()).toBe(before);
			expect(changes).toEqual([]);
		});

		it("collects references from it: a media reference added to the body is indexed", async () => {
			const { id: mediaId } = await store.createMediaAsset({
				filename: "hook.png",
				mimeType: "image/png",
				byteSize: 1024,
				stagingKey: `staging/${randomUUID()}.png`,
			});
			const doc = {
				type: "doc",
				version: STORED_DOCUMENT_VERSION,
				content: [{ type: "image", attrs: { mediaId, alt: "added by a hook" } }],
			} as StoredDocument;
			sources = server({ transform: ({ metadata }) => ({ metadata, doc }) });
			const created = await service.createDraft(await postInput("With image"));
			const references = await store.getWorkingReferences({ entryId: created.id });
			expect(references).toContainEqual(expect.objectContaining({ kind: "media", targetId: mediaId }));
			expect(created.working.doc).not.toBeNull();
		});

		it("applies at publish: the transformed draft is saved and published together, in one transaction", async () => {
			const draft = await newPost("quiet");
			sources = server({
				transform: ({ metadata, doc }) => ({
					metadata: { ...metadata, title: String(metadata.title).toUpperCase() },
					doc,
				}),
			});
			const { entry } = await service.publish({ id: draft.id, expectedVersion: draft.version });
			expect(entry.status).toBe("published");
			expect(entry.published?.metadata.title).toBe("QUIET");
			expect(entry.working.metadata.title).toBe("QUIET");
		});

		it("reports what happened to afterCommit: a saved change then a published one, and only a published one for a plain publish", async () => {
			const changed = await newPost("quiet");
			sources = server({
				transform: ({ metadata, doc }) => ({
					metadata: { ...metadata, title: String(metadata.title).toUpperCase() },
					doc,
				}),
			});
			await service.publish({ id: changed.id, expectedVersion: changed.version });
			expect(changes.map((change) => [change.kind, change.entryId, change.status])).toEqual([
				["saved", changed.id, "published"],
				["published", changed.id, "published"],
			]);

			// The draft is already what the transform returns, so this publish changes nothing and is reported as a plain publish.
			const plain = await newPost("LOUD");
			changes = [];
			await service.publish({ id: plain.id, expectedVersion: plain.version });
			expect(changes.map((change) => [change.kind, change.entryId])).toEqual([["published", plain.id]]);
		});

		it("leaves the draft and the publish as they were when it fails at publish", async () => {
			const draft = await newPost("quiet");
			sources = server({
				transform: ({ metadata, doc }) => ({ metadata: { ...metadata, notAField: "x" }, doc }),
			});
			await expect(service.publish({ id: draft.id, expectedVersion: draft.version })).rejects.toMatchObject({
				code: "invalid_metadata_key",
			});
			const after = await store.getEntry(draft.id);
			expect(after.status).toBe("draft");
			expect(after.version).toBe(draft.version);
		});
	});

	describe("extra validation can only add failures", () => {
		it("blocks a save with the failures it adds, and stores nothing", async () => {
			const draft = await newPost();
			sources = server({ validate: () => ({ issues: [{ code: "no_way", path: "title" }] }) });
			const error = await service
				.saveDraft(draft.id, saveInput(draft, { ...draft.working.metadata, title: "Changed" }))
				.catch((e) => e);
			expect(error).toMatchObject({ code: "validation_failed", issues: [{ code: "no_way", path: "title" }] });
			const after = await store.getEntry(draft.id);
			expect(after.version).toBe(draft.version);
			expect(after.working.metadata.title).toBe(draft.working.metadata.title);
			expect(changes).toEqual([]);
		});

		it("passes warnings through with the result and does not block", async () => {
			sources = server({ validate: () => ({ warnings: [{ code: "consider_this" }] }) });
			const created = await service.createDraft(await postInput("Warned"));
			expect(created.warnings).toEqual([{ code: "consider_this" }]);
			const published = await service.publish({ id: created.id, expectedVersion: created.version });
			expect(published.warnings).toContainEqual({ code: "consider_this" });
			expect(published.entry.status).toBe("published");
		});

		it("does not stop the core checks of a publish: a draft that core rejects stays unpublished however the hooks answer", async () => {
			// A body that does not parse can be saved as a draft (as an unparsed body), and core publish validation blocks it.
			const draft = await newPost("Broken", "<<<Unclosed");
			sources = server({
				validate: () => ({ issues: [], warnings: [{ code: "all_fine" }] }),
				validatePublish: ({ snapshot }) => {
					(snapshot.issues as unknown as unknown[]).length = 0;
					return { issues: [] };
				},
			});
			await expect(service.publish({ id: draft.id, expectedVersion: draft.version })).rejects.toMatchObject({
				code: "publish_validation_failed",
				issues: expect.arrayContaining([expect.objectContaining({ code: "unparsed_body" })]),
			});
			expect((await store.getEntry(draft.id)).status).toBe("draft");
		});

		it("blocks a publish with the failures validatePublish adds, and a save of the same draft still works", async () => {
			const draft = await newPost();
			sources = server({ validatePublish: () => ({ issues: [{ code: "not_ready", path: "title" }] }) });
			await expect(service.publish({ id: draft.id, expectedVersion: draft.version })).rejects.toMatchObject({
				code: "publish_validation_failed",
				issues: expect.arrayContaining([expect.objectContaining({ code: "not_ready" })]),
			});
			expect((await store.getEntry(draft.id)).status).toBe("draft");
			expect(changes).toEqual([]);
			const saved = await service.saveDraft(draft.id, saveInput(draft));
			expect(saved.status).toBe("draft");
		});

		it("calls validatePublish for a publish and for no other write", async () => {
			const seen: WriteOperation[] = [];
			sources = server({
				validatePublish: ({ operation }) => {
					seen.push(operation);
				},
			});
			const draft = await service.createDraft(await postInput("Seen"));
			await service.saveDraft(draft.id, saveInput(draft));
			expect(seen).toEqual([]);
			await service.publish({ id: draft.id, expectedVersion: draft.version });
			expect(seen).toEqual(["publish"]);
		});
	});

	describe("a failure before the commit blocks the write", () => {
		const failing: Record<string, HookSource["hooks"]> = {
			transform: {
				transform: () => {
					throw new Error("transform broke");
				},
			},
			validate: { validate: async () => Promise.reject(new Error("validate broke")) },
			validatePublish: {
				validatePublish: () => {
					throw new Error("validatePublish broke");
				},
			},
		};

		it.each([
			"transform",
			"validate",
		])("fails a create with hook_failed when %s throws: nothing is stored, nothing is sent", async (hook) => {
			sources = [{ owner: "plugin:seo", hooks: failing[hook] }];
			const before = await entryCount();
			const error = await service.createDraft(await postInput("Never stored")).catch((e) => e);
			expect(error).toMatchObject({
				code: "hook_failed",
				issues: [{ code: "hook_failed", params: { hook, owner: "plugin:seo" } }],
			});
			expect(await entryCount()).toBe(before);
			expect(changes).toEqual([]);
		});

		it("fails a save the same way and keeps the draft as it was", async () => {
			const draft = await newPost();
			sources = [{ owner: "server", hooks: failing.transform }];
			await expect(
				service.saveDraft(draft.id, saveInput(draft, { ...draft.working.metadata, title: "Changed" })),
			).rejects.toMatchObject({ code: "hook_failed" });
			const after = await store.getEntry(draft.id);
			expect(after.version).toBe(draft.version);
			expect(after.working.metadata.title).toBe(draft.working.metadata.title);
			expect(changes).toEqual([]);
		});

		it("fails a publish the same way and keeps the entry a draft", async () => {
			const draft = await newPost();
			sources = [{ owner: "server", hooks: failing.validatePublish }];
			await expect(service.publish({ id: draft.id, expectedVersion: draft.version })).rejects.toMatchObject({
				code: "hook_failed",
				issues: [{ params: { hook: "validatePublish", owner: "server" } }],
			});
			const after = await store.getEntry(draft.id);
			expect(after.status).toBe("draft");
			expect(after.version).toBe(draft.version);
			expect(changes).toEqual([]);
		});
	});

	describe("a failure after the commit never undoes the write", () => {
		it("keeps a created, saved and published entry when afterCommit throws", async () => {
			afterCommitFails = true;
			const created = await service.createDraft(await postInput("Survives"));
			expect((await store.getEntry(created.id)).version).toBe(created.version);
			const saved = await service.saveDraft(
				created.id,
				saveInput(created, { ...created.working.metadata, title: "Saved" }),
			);
			expect(saved.version).toBeGreaterThan(created.version);
			const { entry } = await service.publish({ id: created.id, expectedVersion: saved.version });
			expect(entry.status).toBe("published");
			const stored = await store.getEntry(created.id);
			expect(stored.status).toBe("published");
			expect(stored.working.metadata.title).toBe("Saved");
		});

		it("reports a committed publish once, and a blocked one never", async () => {
			const draft = await newPost();
			changes = [];
			sources = server({ validatePublish: () => ({ issues: [{ code: "no" }] }) });
			await service.publish({ id: draft.id, expectedVersion: draft.version }).catch(() => undefined);
			expect(changes).toEqual([]);
			sources = [];
			await service.publish({ id: draft.id, expectedVersion: draft.version });
			expect(changes).toEqual([expect.objectContaining({ kind: "published", entryId: draft.id, status: "published" })]);
		});
	});

	describe("every write operation runs the same hooks", () => {
		type Runner = {
			operation: WriteOperation;
			skip?: boolean;
			run: () => Promise<unknown>;
			unchanged: () => Promise<boolean>;
		};

		/** One runner per way content gets written. Each makes its own draft first, with no hooks registered. */
		const runners = (): Record<string, () => Promise<Runner>> => ({
			create: async () => {
				const input = await postInput("Created");
				const before = await entryCount();
				return {
					operation: "create",
					run: () => service.createDraft(input),
					unchanged: async () => (await entryCount()) === before,
				};
			},
			save: async () => {
				const draft = await newPost();
				return {
					operation: "save",
					run: () => service.saveDraft(draft.id, saveInput(draft, { ...draft.working.metadata, title: "Saved" })),
					unchanged: async () => (await store.getEntry(draft.id)).version === draft.version,
				};
			},
			publish: async () => {
				const draft = await newPost();
				return {
					operation: "publish",
					run: () => service.publish({ id: draft.id, expectedVersion: draft.version }),
					unchanged: async () => (await store.getEntry(draft.id)).status === "draft",
				};
			},
			duplicate: async () => {
				const draft = await newPost();
				const before = await entryCount();
				return {
					operation: "duplicate",
					run: () => service.duplicate({ id: draft.id }),
					unchanged: async () => (await entryCount()) === before,
				};
			},
			translate: async () => {
				const draft = await newPost();
				const before = await entryCount();
				return {
					operation: "translate",
					skip: !secondLocale,
					run: () => service.createTranslation({ sourceId: draft.id, locale: secondLocale ?? "" }),
					unchanged: async () => (await entryCount()) === before,
				};
			},
			"bulk publish": async () => {
				const draft = await newPost();
				return {
					operation: "publish",
					run: async () => {
						const { results } = await bulk.run({
							op: "publish",
							items: [{ id: draft.id, expectedVersion: draft.version }],
						});
						assertBulkItemOk(results[0]);
					},
					unchanged: async () => (await store.getEntry(draft.id)).status === "draft",
				};
			},
			"bulk folder move": async () => {
				const draft = await newPost();
				return {
					operation: "save",
					run: async () => {
						const { results } = await bulk.run({
							op: "folder.move",
							folderId: null,
							items: [{ id: draft.id, expectedVersion: draft.version }],
						});
						assertBulkItemOk(results[0]);
					},
					unchanged: async () => true,
				};
			},
		});

		const names = Object.keys(runners());

		it.each(names)("%s: a transform and both validations see it, with the operation", async (name) => {
			const runner = await runners()[name]();
			if (runner.skip) return;
			const seen: string[] = [];
			sources = server({
				transform: ({ operation, collection, metadata, doc }) => {
					seen.push(`transform:${operation}`);
					expect(collection).toBeTypeOf("string");
					return { metadata, doc };
				},
				validate: ({ operation }) => {
					seen.push(`validate:${operation}`);
				},
				validatePublish: ({ operation }) => {
					seen.push(`validatePublish:${operation}`);
				},
			});
			await runner.run();
			const expected = [`transform:${runner.operation}`, `validate:${runner.operation}`];
			if (runner.operation === "publish") expected.push("validatePublish:publish");
			expect(seen).toEqual(expected);
		});

		it.each(names)("%s: a failure a hook adds blocks it and nothing is stored", async (name) => {
			const runner = await runners()[name]();
			if (runner.skip) return;
			sources = server({
				validate: ({ operation }) => ({ issues: operation === runner.operation ? [{ code: "rule_broken" }] : [] }),
			});
			const error = await runner.run().then(
				() => undefined,
				(e) => e,
			);
			expect(error).toMatchObject({ code: "validation_failed", issues: [{ code: "rule_broken" }] });
			expect(await runner.unchanged()).toBe(true);
			expect(changes).toEqual([]);
		});

		it.each(names)("%s: without a failing hook it is committed and reported", async (name) => {
			const runner = await runners()[name]();
			if (runner.skip) return;
			sources = server({ validate: () => ({ issues: [] }) });
			await runner.run();
			expect(changes.length).toBeGreaterThan(0);
		});
	});

	describe("bulk applies the hooks to every item", () => {
		it("runs them per item and reports each item's own result", async () => {
			const drafts = [await newPost("one"), await newPost("two"), await newPost("three")];
			const seen: (string | undefined)[] = [];
			sources = server({
				transform: ({ entryId, metadata, doc }) => {
					seen.push(entryId);
					return { metadata, doc };
				},
				validatePublish: ({ entryId }) => ({ issues: entryId === drafts[1].id ? [{ code: "held_back" }] : [] }),
			});
			const { results } = await bulk.run({
				op: "publish",
				items: drafts.map((draft) => ({ id: draft.id, expectedVersion: draft.version })),
			});
			expect(seen).toEqual(drafts.map((draft) => draft.id));
			expect(results).toEqual([
				{ id: drafts[0].id, ok: true, version: drafts[0].version + 1 },
				{
					id: drafts[1].id,
					ok: false,
					error: "publish_validation_failed",
					issues: [expect.objectContaining({ code: "held_back" })],
				},
				{ id: drafts[2].id, ok: true, version: drafts[2].version + 1 },
			]);
			expect((await store.getEntry(drafts[1].id)).status).toBe("draft");
		});

		it("reports a failing hook per item with hook_failed", async () => {
			const drafts = [await newPost(), await newPost()];
			sources = [
				{
					owner: "plugin:seo",
					hooks: {
						transform: ({ entryId, metadata, doc }) => {
							if (entryId === drafts[0].id) throw new Error("only the first");
							return { metadata, doc };
						},
					},
				},
			];
			const { results } = await bulk.run({
				op: "folder.move",
				folderId: null,
				items: drafts.map((draft) => ({ id: draft.id, expectedVersion: draft.version })),
			});
			expect(results[0]).toMatchObject({
				id: drafts[0].id,
				ok: false,
				error: "hook_failed",
				issues: [{ params: { hook: "transform", owner: "plugin:seo" } }],
			});
			expect(results[1]).toMatchObject({ id: drafts[1].id, ok: true });
		});

		it("does not run hooks for a status change that is not a content change", async () => {
			const draft = await newPost();
			const hook = vi.fn();
			sources = server({ transform: hook, validate: hook, validatePublish: hook });
			const { results } = await bulk.run({
				op: "archive",
				items: [{ id: draft.id, expectedVersion: draft.version }],
			});
			expect(results[0]).toMatchObject({ ok: true });
			expect(hook).not.toHaveBeenCalled();
			expect(changes).toEqual([expect.objectContaining({ kind: "archived", entryId: draft.id })]);
		});
	});

	describe("registration order", () => {
		it("runs the server config's hooks before the plugins' and the plugins in order", async () => {
			const order: string[] = [];
			const tag = (owner: string): HookSource => ({
				owner,
				hooks: {
					transform: ({ metadata, doc }) => {
						order.push(owner);
						return { metadata, doc };
					},
				},
			});
			sources = [tag("server"), tag("plugin:a"), tag("plugin:b")];
			await service.createDraft(await postInput("Ordered"));
			expect(order).toEqual(["server", "plugin:a", "plugin:b"]);
		});
	});

	describe("restoring a record publishes it again, so publish restrictions apply", () => {
		const trashedRecord = async () => {
			const registered = sources;
			sources = [];
			try {
				const record = await service.createDraft({
					collection: recordCollection,
					slug: unique("record"),
					metadata: await requiredMetadata(recordCollection, unique("record title"), relationTarget),
					format: "paragraphs",
					body: "",
				});
				const trashed = await store.trashEntry({ id: record.id, expectedVersion: record.version });
				changes = [];
				return { id: record.id, version: trashed.version };
			} finally {
				sources = registered;
			}
		};

		it("runs validate and validatePublish with operation restore, and not transform", async () => {
			const record = await trashedRecord();
			const seen: string[] = [];
			const transform = vi.fn();
			sources = server({
				transform,
				validate: ({ operation }) => {
					seen.push(`validate:${operation}`);
				},
				validatePublish: ({ operation }) => {
					seen.push(`validatePublish:${operation}`);
				},
			});
			const restored = await service.restore({ id: record.id, expectedVersion: record.version });
			expect(restored.status).toBe("published");
			expect(seen).toEqual(["validate:restore", "validatePublish:restore"]);
			expect(transform).not.toHaveBeenCalled();
		});

		it("is blocked by a publish restriction: the record stays in the trash and nothing is sent", async () => {
			const record = await trashedRecord();
			sources = server({ validatePublish: () => ({ issues: [{ code: "publishing_closed" }] }) });
			await expect(service.restore({ id: record.id, expectedVersion: record.version })).rejects.toMatchObject({
				code: "publish_validation_failed",
				issues: expect.arrayContaining([expect.objectContaining({ code: "publishing_closed" })]),
			});
			const after = await store.getEntry(record.id);
			expect(after.status).toBe("trashed");
			expect(after.version).toBe(record.version);
			expect(changes).toEqual([]);
		});

		it("is blocked by a validate failure too, and by a hook that throws", async () => {
			const record = await trashedRecord();
			sources = server({ validate: () => ({ issues: [{ code: "no_restore" }] }) });
			await expect(service.restore({ id: record.id, expectedVersion: record.version })).rejects.toMatchObject({
				code: "validation_failed",
			});
			sources = server({
				validatePublish: () => {
					throw new Error("down");
				},
			});
			await expect(service.restore({ id: record.id, expectedVersion: record.version })).rejects.toMatchObject({
				code: "hook_failed",
			});
			expect((await store.getEntry(record.id)).status).toBe("trashed");
		});
	});

	it("keeps seeded drafts that bypass core preparation publishable only through the pipeline", async () => {
		// A raw seed stores values as given; publishing prepares them, so the transform sees the stored draft.
		const seeded = await seedEntry(store, {
			collection: contentCollection,
			slug: unique("seeded"),
			metadata: await requiredMetadata(contentCollection, "seeded", relationTarget),
			text: "Body",
		});
		const seen: unknown[] = [];
		sources = server({
			transform: ({ metadata, doc }) => {
				seen.push(metadata.title);
				return { metadata, doc };
			},
		});
		await service.publish({ id: seeded.id, expectedVersion: seeded.version });
		expect(seen).toEqual(["seeded"]);
	});
});

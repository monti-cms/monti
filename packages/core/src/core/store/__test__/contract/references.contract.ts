import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	contentCollection,
	fillRequiredMetadata,
	recordCollection,
	recordRelationField,
} from "../../../../../test/any-site";
import { contentOf, docOf } from "../../../../../test/stored-content";
import { storedFields } from "../../../../schema/derive";
import { type Collection, isItemCollection } from "../../../collections";
import type { PreparedSnapshot, Reference } from "../../../types";
import type { ContentStore } from "../..";
import { CmsError } from "../..";
import { publishDraft, seedEntry } from "../seed";
import type { ContractSuite, StoreSession } from "./harness";

/** Contract of the reference index kept by EntryStore: working references, incoming references, and what a failed or conflicting write leaves behind. */

/**
 * A relation field where a body collection points at an item collection. A multi-select field is preferred (it also tests the order `ordinal`).
 * Collection and field names are looked up in the current config (`test/any-site.ts`).
 */
const relation = (() => {
	for (const { name, field, when } of storedFields(contentCollection)) {
		if (!when && field.kind === "relation" && field.many && isItemCollection(field.to)) {
			return { name, to: field.to as Collection, many: true };
		}
	}
	return recordRelationField(contentCollection);
})();
/** The item collection that creates reference targets and the reference location (metadata path). Tests that only check the store contract use just the name. */
const targetCollection = relation?.to ?? recordCollection;
const relationPath = relation?.name ?? "relationId";

/** A prepared snapshot. The body is given as text (`text`) and stored as the document it reads as. */
function buildSnapshot(overrides: Partial<PreparedSnapshot> & { text?: string } = {}): PreparedSnapshot {
	const { text, ...rest } = overrides;
	const refs = overrides.references || [];
	return {
		collection: contentCollection,
		slug: `test-slug-${Math.random().toString(36).slice(2, 8)}`,
		metadata: { title: "Test" },
		doc: docOf(text ?? "Test content"),
		schemaVersion: 1,
		contentHash: `hash-${Math.random().toString(36).slice(2, 8)}`,
		issues: [],
		imageSources: [],
		...rest,
		references: refs,
	};
}

function buildReference(overrides: Partial<Reference> = {}): Reference {
	return {
		kind: "entry",
		targetId: "00000000-0000-0000-0000-000000000000",
		isStale: false,
		occurrences: [{ type: "metadata", path: relationPath }],
		...overrides,
	};
}

export const referencesContract: ContractSuite = (factory) => {
	describe("EntryStore: incoming references", () => {
		let session: StoreSession;
		let store: ContentStore;

		beforeAll(async () => {
			session = await factory.create();
			store = session.store;
			// Publishing requires the required-for-publish values. Only this describe uses a store that fills in the missing required values.
			fillRequiredMetadata(store);
		});

		afterAll(async () => {
			await session.close();
		});

		it.skipIf(!relation)("returns working and current published incoming references separately", async () => {
			if (!relation) return;
			const target = await seedEntry(store, {
				collection: relation.to,
				slug: `incoming-tag-${randomUUID()}`,
				metadata: { title: "Reference tag" },
				text: "",
				schemaVersion: 1,
				contentHash: `tag-${randomUUID()}`,
			});
			if (target.status !== "published") await publishDraft(store, { id: target.id, expectedVersion: target.version });

			const occurrence = relation.many
				? { type: "metadata" as const, path: relation.name, ordinal: 0 }
				: { type: "metadata" as const, path: relation.name };
			const value = relation.many ? [target.id] : target.id;
			const reference = buildReference({ kind: "entry", targetId: target.id, occurrences: [occurrence] });
			const source = await store.createEntryWithReferences({
				snapshot: buildSnapshot({
					slug: `incoming-memo-${randomUUID()}`,
					metadata: { title: "Published title", [relation.name]: value },
					references: [reference],
				}),
				references: [reference],
			});
			const published = await publishDraft(store, { id: source.id, expectedVersion: source.version });
			const draftSlug = `incoming-draft-${randomUUID()}`;
			await store.saveWorkingWithReferences({
				entryId: source.id,
				expectedVersion: published.version,
				snapshot: buildSnapshot({
					slug: draftSlug,
					metadata: { title: "Draft title", [relation.name]: value },
					references: [reference],
				}),
				references: [reference],
			});

			const incoming = await store.getIncomingReferences({ targetId: target.id });
			expect(incoming).toHaveLength(2);
			expect(incoming).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						state: "working",
						sourceTitle: "Draft title",
						sourceSlug: draftSlug,
						occurrences: [occurrence],
					}),
					expect.objectContaining({
						state: "published",
						sourceTitle: "Published title",
						sourceSlug: source.workingSlug,
						occurrences: [occurrence],
					}),
				]),
			);
		});
	});

	describe("EntryStore: ContentStore References", () => {
		let session: StoreSession;
		let store: ContentStore;

		beforeAll(async () => {
			session = await factory.create();
			store = session.store;
		});

		afterAll(async () => {
			await session.close();
		});

		it("create atomically persists working snapshot + normalized working references, including multiple occurrences", async () => {
			const targetCat = await seedEntry(store, {
				collection: targetCollection,
				slug: "cat-1",
				metadata: {},
				text: "",
				schemaVersion: 1,
				contentHash: "c1",
			});
			const targetTag = await seedEntry(store, {
				collection: targetCollection,
				slug: "tag-1",
				metadata: {},
				text: "",
				schemaVersion: 1,
				contentHash: "t1",
			});

			const ref1 = buildReference({
				kind: "entry",
				targetId: targetCat.id,
				isStale: true,
				occurrences: [
					{ type: "metadata", path: relationPath },
					{ type: "body", blockId: "abcd1234" },
				],
			});
			const ref2 = buildReference({
				kind: "entry",
				targetId: targetTag.id,
				isStale: false,
				occurrences: [{ type: "metadata", path: relationPath, ordinal: 0 }],
			});

			const snapshot = buildSnapshot({
				slug: "create-refs",
				contentHash: "fixed-hash",
				text: "fixed-mdx",
				schemaVersion: 2,
				metadata: { test: "val" },
				references: [ref2, ref1],
			});

			const entry = await store.createEntryWithReferences({ snapshot, references: [ref2, ref1] });
			expect(entry.id).toBeDefined();

			const refs = await store.getWorkingReferences({ entryId: entry.id });
			expect(refs).toHaveLength(2);

			const sortedExpected = [ref1, ref2].sort(
				(a, b) => a.kind.localeCompare(b.kind) || a.targetId.localeCompare(b.targetId),
			);
			const sortedActual = [...refs].sort(
				(a, b) => a.kind.localeCompare(b.kind) || a.targetId.localeCompare(b.targetId),
			);
			expect(sortedActual).toEqual(sortedExpected);

			const saved = await store.getEntry(entry.id);
			expect(saved.working.metadata).toEqual(snapshot.metadata);
			expect(contentOf(saved.working.doc)).toEqual(contentOf(snapshot.doc));
			expect(saved.working.schemaVersion).toEqual(snapshot.schemaVersion);
			expect(saved.working.contentHash).toEqual(snapshot.contentHash);
			expect(saved.workingSlug).toEqual(snapshot.slug);
		});

		it("save atomically replaces the complete working reference set (removes old/adds new), increments numeric version, and stores matching body/slug", async () => {
			const targetOld = await seedEntry(store, {
				collection: targetCollection,
				slug: "old-tag",
				metadata: {},
				text: "",
				schemaVersion: 1,
				contentHash: "1",
			});
			const targetNew = await seedEntry(store, {
				collection: targetCollection,
				slug: "new-cat",
				metadata: {},
				text: "",
				schemaVersion: 1,
				contentHash: "2",
			});

			const refOld = buildReference({ kind: "entry", targetId: targetOld.id });
			const snapshot1 = buildSnapshot({ slug: "save-refs-1", references: [refOld] });
			const entry1 = await store.createEntryWithReferences({ snapshot: snapshot1, references: [refOld] });

			const refNew = buildReference({ kind: "entry", targetId: targetNew.id });
			const snapshot2 = buildSnapshot({
				slug: "save-refs-2",
				metadata: { title: "Updated" },
				contentHash: "hash-2",
				text: "updated",
				schemaVersion: 3,
				references: [refNew],
			});

			const entry2 = await store.saveWorkingWithReferences({
				entryId: entry1.id,
				expectedVersion: entry1.version,
				snapshot: snapshot2,
				references: [refNew],
			});

			expect(entry2.version).toBe(entry1.version + 1);
			expect(entry2.workingSlug).toBe("save-refs-2");
			expect(entry2.working.metadata).toEqual(snapshot2.metadata);
			expect(contentOf(entry2.working.doc)).toEqual(contentOf(snapshot2.doc));
			expect(entry2.working.contentHash).toEqual(snapshot2.contentHash);
			expect(entry2.working.schemaVersion).toEqual(snapshot2.schemaVersion);

			const refs = await store.getWorkingReferences({ entryId: entry1.id });
			expect(refs).toHaveLength(1);
			expect(refs[0]).toEqual(refNew);
		});

		it("stale references and occurrences survive exact DB roundtrip", async () => {
			const target = await seedEntry(store, {
				collection: targetCollection,
				slug: "cat-stale",
				metadata: {},
				text: "",
				schemaVersion: 1,
				contentHash: "1",
			});

			const ref = buildReference({
				targetId: target.id,
				isStale: true,
				occurrences: [
					{ type: "metadata", path: "test" },
					{ type: "body", blockId: "abcd1234" },
				],
			});
			const snapshot = buildSnapshot({ references: [ref] });
			const entry = await store.createEntryWithReferences({ snapshot, references: [ref] });

			const refs = await store.getWorkingReferences({ entryId: entry.id });
			expect(refs[0]).toEqual(ref);
		});

		it("reference-only mutation is a real optimistic-version mutation (increments version) and stale flag updates", async () => {
			const target = await seedEntry(store, {
				collection: targetCollection,
				slug: "cat-ref-only",
				metadata: {},
				text: "",
				schemaVersion: 1,
				contentHash: "1",
			});
			const ref1 = buildReference({ targetId: target.id, isStale: false });
			const snapshot1 = buildSnapshot({ references: [ref1] });
			const entry1 = await store.createEntryWithReferences({ snapshot: snapshot1, references: [ref1] });

			const ref2 = buildReference({ targetId: target.id, isStale: true });
			const snapshot2 = { ...snapshot1, references: [ref2] };
			const entry2 = await store.saveWorkingWithReferences({
				entryId: entry1.id,
				expectedVersion: entry1.version,
				snapshot: snapshot2,
				references: [ref2],
			});

			expect(entry2.version).toBe(entry1.version + 1);
			expect(entry2.working).toEqual(entry1.working);

			const refs = await store.getWorkingReferences({ entryId: entry1.id });
			expect(refs[0].isStale).toBe(true);

			let conflictErr: unknown;
			try {
				const snapshot3 = buildSnapshot({ references: [] });
				await store.saveWorkingWithReferences({
					entryId: entry1.id,
					expectedVersion: entry1.version,
					snapshot: snapshot3,
					references: [],
				});
			} catch (e) {
				conflictErr = e;
			}
			expect(conflictErr).toBeDefined();
			expect(conflictErr).toBeInstanceOf(CmsError);
			expect((conflictErr as CmsError).code).toBe("conflict");
			expect((conflictErr as CmsError).serverVersion).toBe(entry2.version);
		});

		it("optimistic version conflict preserves prior working snapshot, slug and refs", async () => {
			const target1 = await seedEntry(store, {
				collection: targetCollection,
				slug: "cat-opt-1",
				metadata: {},
				text: "",
				schemaVersion: 1,
				contentHash: "1",
			});
			const target2 = await seedEntry(store, {
				collection: targetCollection,
				slug: "cat-opt-2",
				metadata: {},
				text: "",
				schemaVersion: 1,
				contentHash: "2",
			});

			const ref1 = buildReference({ targetId: target1.id });
			const snapshot1 = buildSnapshot({
				slug: "conflict-1",
				contentHash: "opt-hash",
				text: "opt-mdx",
				references: [ref1],
			});
			const entry1 = await store.createEntryWithReferences({ snapshot: snapshot1, references: [ref1] });
			const priorRefs = await store.getWorkingReferences({ entryId: entry1.id });

			const ref2 = buildReference({ targetId: target2.id });
			const snapshot2 = buildSnapshot({
				slug: "conflict-2",
				contentHash: "opt-hash-2",
				text: "opt-mdx-2",
				references: [ref2],
			});

			let err: unknown;
			try {
				await store.saveWorkingWithReferences({
					entryId: entry1.id,
					expectedVersion: entry1.version - 1,
					snapshot: snapshot2,
					references: [ref2],
				});
			} catch (e) {
				err = e;
			}
			expect(err).toBeDefined();
			expect(err).toBeInstanceOf(CmsError);
			expect((err as CmsError).code).toBe("conflict");
			expect((err as CmsError).serverVersion).toBe(entry1.version);

			const saved = await store.getEntry(entry1.id);
			expect(saved.version).toBe(entry1.version);
			expect(saved.workingSlug).toBe(entry1.workingSlug);
			expect(saved.working).toEqual(entry1.working);

			const refs = await store.getWorkingReferences({ entryId: entry1.id });
			expect(refs).toEqual(priorRefs);
		});

		it("save rollback: invalid/nonexistent entry target causes failure and fully rolls back body/version/working slug/reference replacement", async () => {
			const targetReal = await seedEntry(store, {
				collection: targetCollection,
				slug: "cat-real-1",
				metadata: {},
				text: "",
				schemaVersion: 1,
				contentHash: "1",
			});

			const ref1 = buildReference({ kind: "entry", targetId: targetReal.id });
			const snapshot1 = buildSnapshot({ slug: "valid-target", contentHash: "hash1", text: "mdx1", references: [ref1] });
			const entry1 = await store.createEntryWithReferences({ snapshot: snapshot1, references: [ref1] });
			const priorRefs = await store.getWorkingReferences({ entryId: entry1.id });

			const nonexistentId = randomUUID();
			const ref2 = buildReference({ kind: "entry", targetId: nonexistentId });
			const snapshot2 = buildSnapshot({
				slug: "invalid-target",
				contentHash: "hash2",
				text: "text2",
				references: [ref2],
			});

			let err: unknown;
			try {
				await store.saveWorkingWithReferences({
					entryId: entry1.id,
					expectedVersion: entry1.version,
					snapshot: snapshot2,
					references: [ref2],
				});
			} catch (e) {
				err = e;
			}
			expect(err).toBeDefined();

			const saved = await store.getEntry(entry1.id);
			expect(saved.version).toBe(entry1.version);
			expect(saved.workingSlug).toBe(entry1.workingSlug);
			expect(saved.working).toEqual(entry1.working);

			const refs = await store.getWorkingReferences({ entryId: entry1.id });
			expect(refs).toEqual(priorRefs);
		});

		it("create/save working slug collision is normalized to CmsError code slug_conflict and transaction rollback leaves no partial create or preserves existing saved state respectively", async () => {
			const targetReal = await seedEntry(store, {
				collection: targetCollection,
				slug: "cat-real-2",
				metadata: {},
				text: "",
				schemaVersion: 1,
				contentHash: "1",
			});

			const snapshot1 = buildSnapshot({ slug: "collision-slug", references: [] });
			const _entry1 = await store.createEntryWithReferences({ snapshot: snapshot1, references: [] });

			const snapshot2 = buildSnapshot({ slug: "collision-slug", references: [] });
			let err1: unknown;
			try {
				await store.createEntryWithReferences({ snapshot: snapshot2, references: [] });
			} catch (e) {
				err1 = e;
			}
			expect(err1).toBeInstanceOf(CmsError);
			expect((err1 as CmsError).code).toBe("slug_conflict");

			const sameSlug = await store.listEntries({
				collection: snapshot1.collection,
				slugContains: "collision-slug",
				pageSize: 100,
			});
			expect(sameSlug.items.filter((item) => item.slug === "collision-slug").map((item) => item.id)).toEqual([
				_entry1.id,
			]);

			const ref3 = buildReference({ targetId: targetReal.id });
			const snapshot3 = buildSnapshot({
				slug: "safe-slug",
				contentHash: "safe-hash",
				text: "safe-mdx",
				references: [ref3],
			});
			const entry3 = await store.createEntryWithReferences({ snapshot: snapshot3, references: [ref3] });
			const priorRefs3 = await store.getWorkingReferences({ entryId: entry3.id });

			let err2: unknown;
			try {
				const snapshotCollision = buildSnapshot({
					slug: "collision-slug",
					contentHash: "col-hash",
					text: "col-mdx",
					references: [],
				});
				await store.saveWorkingWithReferences({
					entryId: entry3.id,
					expectedVersion: entry3.version,
					snapshot: snapshotCollision,
					references: [],
				});
			} catch (e) {
				err2 = e;
			}
			expect(err2).toBeInstanceOf(CmsError);
			expect((err2 as CmsError).code).toBe("slug_conflict");

			const saved3 = await store.getEntry(entry3.id);
			expect(saved3.version).toBe(entry3.version);
			expect(saved3.workingSlug).toBe(entry3.workingSlug);
			expect(saved3.working).toEqual(entry3.working);

			const currentRefs = await store.getWorkingReferences({ entryId: entry3.id });
			expect(currentRefs).toEqual(priorRefs3);
		});

		it("references are isolated per source entry", async () => {
			const target1 = await seedEntry(store, {
				collection: targetCollection,
				slug: "cat-iso-1",
				metadata: {},
				text: "",
				schemaVersion: 1,
				contentHash: "1",
			});
			const target2 = await seedEntry(store, {
				collection: targetCollection,
				slug: "cat-iso-2",
				metadata: {},
				text: "",
				schemaVersion: 1,
				contentHash: "2",
			});

			const ref1 = buildReference({ targetId: target1.id });
			const snapshot1 = buildSnapshot({ references: [ref1] });
			const entry1 = await store.createEntryWithReferences({ snapshot: snapshot1, references: [ref1] });

			const ref2 = buildReference({ targetId: target2.id });
			const snapshot2 = buildSnapshot({ references: [ref2] });
			const entry2 = await store.createEntryWithReferences({ snapshot: snapshot2, references: [ref2] });

			const refs1 = await store.getWorkingReferences({ entryId: entry1.id });
			expect(refs1).toHaveLength(1);
			expect(refs1[0].targetId).toBe(target1.id);

			const refs2 = await store.getWorkingReferences({ entryId: entry2.id });
			expect(refs2).toHaveLength(1);
			expect(refs2[0].targetId).toBe(target2.id);
		});

		it("successful nonempty -> empty save: replaces refs with empty array and increments version", async () => {
			const targetReal = await seedEntry(store, {
				collection: targetCollection,
				slug: "empty-save-cat",
				metadata: {},
				text: "",
				schemaVersion: 1,
				contentHash: "1",
			});
			const ref1 = buildReference({ kind: "entry", targetId: targetReal.id });
			const snapshot1 = buildSnapshot({ slug: "empty-save-1", references: [ref1] });
			const entry1 = await store.createEntryWithReferences({ snapshot: snapshot1, references: [ref1] });

			const snapshot2 = buildSnapshot({
				slug: "empty-save-2",
				metadata: { title: "Cleared" },
				text: "cleared content",
				schemaVersion: 2,
				contentHash: "hash-empty-2",
				references: [],
			});
			const entry2 = await store.saveWorkingWithReferences({
				entryId: entry1.id,
				expectedVersion: entry1.version,
				snapshot: snapshot2,
				references: [],
			});
			expect(entry2.version).toBe(entry1.version + 1);
			expect(entry2.workingSlug).toBe("empty-save-2");
			expect(entry2.working.metadata).toEqual(snapshot2.metadata);
			expect(contentOf(entry2.working.doc)).toEqual(contentOf(snapshot2.doc));
			expect(entry2.working.schemaVersion).toEqual(snapshot2.schemaVersion);
			expect(entry2.working.contentHash).toEqual(snapshot2.contentHash);

			const currentRefs = await store.getWorkingReferences({ entryId: entry1.id });
			expect(currentRefs).toHaveLength(0);
		});

		it("identical snapshot + identical refs no-op save: timestamps and version remain unchanged", async () => {
			const targetReal = await seedEntry(store, {
				collection: targetCollection,
				slug: "noop-cat",
				metadata: {},
				text: "",
				schemaVersion: 1,
				contentHash: "1",
			});
			const ref1 = buildReference({ kind: "entry", targetId: targetReal.id });
			const snapshot1 = buildSnapshot({ slug: "noop-save", references: [ref1] });
			const entry1 = await store.createEntryWithReferences({ snapshot: snapshot1, references: [ref1] });

			const entry2 = await store.saveWorkingWithReferences({
				entryId: entry1.id,
				expectedVersion: entry1.version,
				snapshot: snapshot1,
				references: [ref1],
			});

			expect(entry2.version).toBe(entry1.version);
			expect(entry2.updatedAt).toEqual(entry1.updatedAt);
			expect(entry2.working.updatedAt).toEqual(entry1.working.updatedAt);
			expect(entry2.workingSlug).toBe(entry1.workingSlug);
			expect(entry2.working).toEqual(entry1.working);

			const currentRefs = await store.getWorkingReferences({ entryId: entry1.id });
			expect(currentRefs).toHaveLength(1);
			expect(currentRefs[0]).toEqual(ref1);
		});

		it("collection mismatch on save rejects with CmsError invalid_input and leaves working entry and references unchanged", async () => {
			const targetReal = await seedEntry(store, {
				collection: targetCollection,
				slug: `target-${randomUUID()}`,
				metadata: {},
				text: "",
				schemaVersion: 1,
				contentHash: "1",
			});
			const ref1 = buildReference({ kind: "entry", targetId: targetReal.id });
			const snapshot1 = buildSnapshot({ collection: contentCollection, slug: "mismatch-source", references: [ref1] });
			const entry1 = await store.createEntryWithReferences({ snapshot: snapshot1, references: [ref1] });
			const priorRefs = await store.getWorkingReferences({ entryId: entry1.id });
			const addressesInUse = async () => ({
				source: await store.slugsInUse({
					collection: contentCollection,
					locale: entry1.locale,
					slugs: ["mismatch-source", "mismatch-changed"],
				}),
				target: await store.slugsInUse({
					collection: targetCollection,
					locale: entry1.locale,
					slugs: ["mismatch-source", "mismatch-changed"],
				}),
			});
			const priorAddresses = await addressesInUse();

			const ref2 = buildReference({ kind: "entry", targetId: targetReal.id });
			const snapshot2 = buildSnapshot({
				collection: targetCollection,
				slug: "mismatch-changed",
				contentHash: "changed-hash",
				text: "changed-mdx",
				references: [ref2],
			});

			let err: unknown;
			try {
				await store.saveWorkingWithReferences({
					entryId: entry1.id,
					expectedVersion: entry1.version,
					snapshot: snapshot2,
					references: [ref2],
				});
			} catch (e) {
				err = e;
			}
			expect(err).toBeDefined();
			expect(err).toBeInstanceOf(CmsError);
			expect((err as CmsError).code).toBe("invalid_input");

			const saved = await store.getEntry(entry1.id);
			expect(saved.collection).toBe(contentCollection);
			expect(saved.version).toBe(entry1.version);
			expect(saved.workingSlug).toBe(entry1.workingSlug);
			expect(saved.working).toEqual(entry1.working);
			expect(saved.updatedAt).toEqual(entry1.updatedAt);
			expect(saved.working.updatedAt).toEqual(entry1.working.updatedAt);

			expect(await addressesInUse()).toEqual(priorAddresses);

			const currentRefs = await store.getWorkingReferences({ entryId: entry1.id });
			expect(currentRefs).toEqual(priorRefs);
		});

		it("preserves reference occurrences, stale flag, normalized targetId casing and avoids false mutations", async () => {
			const target = await seedEntry(store, {
				collection: targetCollection,
				slug: `cat-norm-${randomUUID()}`,
				metadata: { name: "Category Normalization Target" },
				text: "",
				schemaVersion: 1,
				contentHash: "hash-cat-norm",
			});

			const upperTargetId = target.id.toUpperCase();
			const refUpper = buildReference({
				kind: "entry",
				targetId: upperTargetId,
				isStale: true,
				occurrences: [
					{ type: "metadata", path: relationPath },
					{ type: "body", blockId: "abcd1234" },
				],
			});

			const originalSnapshot = buildSnapshot({
				slug: `post-norm-${randomUUID()}`,
				references: [refUpper],
			});

			const created = await store.createEntryWithReferences({
				snapshot: originalSnapshot,
				references: [refUpper],
			});

			const initialDbRefs = await store.getWorkingReferences({ entryId: created.id });
			expect(initialDbRefs).toHaveLength(1);
			expect(initialDbRefs[0].kind).toBe("entry");
			expect(initialDbRefs[0].isStale).toBe(true);
			expect(initialDbRefs[0].occurrences).toEqual(refUpper.occurrences);
			expect(initialDbRefs[0].targetId).toBe(target.id.toLowerCase());

			const saved = await store.saveWorkingWithReferences({
				entryId: created.id,
				expectedVersion: created.version,
				snapshot: originalSnapshot,
				references: [refUpper],
			});

			expect(saved.version).toBe(created.version);
			expect(saved.updatedAt).toEqual(created.updatedAt);
			expect(saved.working.updatedAt).toEqual(created.working.updatedAt);
			expect(saved.working.doc).toEqual(created.working.doc);
			expect(saved.workingSlug).toBe(created.workingSlug);

			const subsequentDbRefs = await store.getWorkingReferences({ entryId: created.id });
			expect(subsequentDbRefs).toEqual(initialDbRefs);
		});
	});
};

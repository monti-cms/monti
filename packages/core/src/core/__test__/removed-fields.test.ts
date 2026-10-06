import { describe, expect, it } from "vitest";
import { contentCollection, recordCollection, requiredMetadata } from "../../../test/any-site";
import {
	commonFieldKeys,
	isOrphanedMetadataKey,
	orphanedMetadataKeys,
	RECORD_TRANSLATIONS_KEY,
	schemaMetadata,
	storedFields,
	unknownSelectValues,
} from "../../schema/derive";
import type { ServiceInput } from "../../services/types";
import type { Collection } from "../collections";
import { prepareSnapshot, validateForPublish } from "../snapshot";

/** A key no config has a field for (what a removed field leaves behind), and an option no select lists (what a removed option leaves behind). */
const ORPHAN = "removedField";
const UNKNOWN_OPTION = "removed-option";
const select = storedFields(contentCollection).find(({ field, when }) => !when && field.kind === "select");

const targets: { id: string; isPublished: boolean; collection: Collection }[] = [];
const relationTarget = async (to: Collection) => {
	const known = targets.find((target) => target.collection === to);
	if (known) return known.id;
	const id = `123e4567-e89b-12d3-a456-4266141742${String(targets.length).padStart(2, "0")}`;
	targets.push({ id, isPublished: true, collection: to });
	return id;
};

const draft = async (extra: Record<string, unknown> = {}) =>
	({
		collection: contentCollection,
		slug: "a",
		metadata: { ...(await requiredMetadata(contentCollection, "T", relationTarget)), ...extra },
		mdx: "Body",
	}) as unknown as ServiceInput;

/** Prepares an input for an entry that already holds exactly these keys: a save of stored metadata. */
const prepareHeld = (input: ServiceInput) =>
	prepareSnapshot(input, { previousMetadata: input.metadata as Record<string, unknown> });

describe("values of removed fields", () => {
	it("rejects a new unknown key, as a typo, on create and on save", async () => {
		await expect(prepareSnapshot(await draft({ titel: "typo" }))).rejects.toMatchObject({
			code: "invalid_metadata_key",
		});
		await expect(
			prepareSnapshot(await draft({ titel: "typo" }), { previousMetadata: { title: "T" } }),
		).rejects.toMatchObject({ code: "invalid_metadata_key" });
	});

	it("keeps an unknown key only when the entry already holds it, and rejects the other new ones beside it", async () => {
		const input = await draft({ [ORPHAN]: "left" });
		const kept = await prepareSnapshot(input, { previousMetadata: { [ORPHAN]: "older value" } });
		expect(kept.metadata[ORPHAN]).toBe("left");
		await expect(
			prepareSnapshot(await draft({ [ORPHAN]: "left", titel: "typo" }), { previousMetadata: { [ORPHAN]: "x" } }),
		).rejects.toMatchObject({ code: "invalid_metadata_key" });
	});

	it("keeps a value whose field is not in the schema, as written", async () => {
		const snapshot = await prepareHeld(await draft({ [ORPHAN]: "left", [`${ORPHAN}List`]: ["a", "b"] }));
		expect(snapshot.metadata[ORPHAN]).toBe("left");
		expect(snapshot.metadata[`${ORPHAN}List`]).toEqual(["a", "b"]);
		expect(snapshot.issues).toEqual([]);
	});

	it("keeps it on an item collection as well", async () => {
		const snapshot = await prepareHeld({
			collection: recordCollection,
			slug: "a",
			metadata: { title: "T", [ORPHAN]: "left" },
			mdx: "",
		} as unknown as ServiceInput);
		expect(snapshot.metadata[ORPHAN]).toBe("left");
	});

	it("still checks that a kept value is a string or a list of strings", async () => {
		await expect(prepareHeld(await draft({ [ORPHAN]: 1 }))).rejects.toMatchObject({
			code: "invalid_metadata_type",
		});
		await expect(prepareHeld(await draft({ [ORPHAN]: ["a", 1] }))).rejects.toMatchObject({
			code: "invalid_metadata_type",
		});
		await expect(prepareHeld(await draft({ [ORPHAN]: { nested: "x" } }))).rejects.toMatchObject({
			code: "invalid_metadata_type",
		});
	});

	it("keeps the value in the content hash: it is part of the stored metadata", async () => {
		const without = await prepareHeld(await draft());
		const withValue = await prepareHeld(await draft({ [ORPHAN]: "left" }));
		const other = await prepareHeld(await draft({ [ORPHAN]: "changed" }));
		expect(withValue.contentHash).not.toBe(without.contentHash);
		expect(other.contentHash).not.toBe(withValue.contentHash);
		expect(await prepareHeld(await draft({ [ORPHAN]: "left" }))).toMatchObject({
			contentHash: withValue.contentHash,
		});
	});

	it("does not block publishing and warns once per removed field, with the field key as the path", async () => {
		const snapshot = await prepareHeld(await draft({ [ORPHAN]: "left", other: ["x"] }));
		const validation = validateForPublish(snapshot, { targets, media: [] });
		expect(validation.ready).toBe(true);
		expect(validation.issues).toEqual([]);
		const orphans = validation.warnings.filter((warning) => warning.code === "orphaned_metadata_key");
		expect(orphans.map((warning) => warning.path).sort()).toEqual(["other", ORPHAN]);
	});

	it("raises no warning when nothing was removed", async () => {
		const snapshot = await prepareHeld(await draft());
		expect(snapshot.warnings).toEqual([]);
	});

	it("does not take the per-language names of an item collection for a removed field", () => {
		expect(isOrphanedMetadataKey(recordCollection, RECORD_TRANSLATIONS_KEY)).toBe(false);
		expect(
			orphanedMetadataKeys(recordCollection, { title: "T", [RECORD_TRANSLATIONS_KEY]: {}, [ORPHAN]: "x" }),
		).toEqual([ORPHAN]);
	});

	it("is not a shared field of a translation", () => {
		expect(commonFieldKeys(contentCollection, { [ORPHAN]: "x" })).toEqual([]);
	});

	it("is left out of the metadata as the current schema types it", () => {
		expect(schemaMetadata(contentCollection, { title: "T", [ORPHAN]: "x" })).toEqual({ title: "T" });
	});
});

describe.skipIf(!select)("a select value that is no longer an option", () => {
	const name = select?.name ?? "";

	it("is kept as written instead of failing", async () => {
		const snapshot = await prepareHeld(await draft({ [name]: UNKNOWN_OPTION }));
		expect(snapshot.metadata[name]).toBe(UNKNOWN_OPTION);
		expect(snapshot.issues).toEqual([]);
	});

	it("does not block publishing and warns with the field key as the path and the value as the message", async () => {
		const snapshot = await prepareHeld(await draft({ [name]: UNKNOWN_OPTION }));
		const validation = validateForPublish(snapshot, { targets, media: [] });
		expect(validation.ready).toBe(true);
		expect(validation.warnings).toContainEqual(
			expect.objectContaining({ code: "unknown_select_value", path: name, message: UNKNOWN_OPTION }),
		);
	});

	it("is told apart from an option the select still has", async () => {
		const field = select?.field;
		if (field?.kind !== "select") throw new Error("not a select");
		const [option] = Object.keys(field.options);
		expect(unknownSelectValues(contentCollection, { [name]: option })).toEqual([]);
		expect(unknownSelectValues(contentCollection, { [name]: UNKNOWN_OPTION })).toEqual([
			{ path: name, values: [UNKNOWN_OPTION] },
		]);
	});
});

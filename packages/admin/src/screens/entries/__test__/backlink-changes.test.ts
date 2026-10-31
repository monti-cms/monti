import type { BacklinkField } from "@monti-cms/core";
import { describe, expect, it } from "vitest";
import { backlinkChangeTo, backlinkShown, writeBacklink } from "../backlink-changes";
import { conflictError, ENTRY, fakeClient } from "./entry-editor-fakes";

const field: BacklinkField = { kind: "backlink", label: "시리즈", from: "collection", via: "itemIds" };
const server = [
	{ id: "s1", title: "시리즈 하나" },
	{ id: "s2", title: "시리즈 둘" },
];

describe("backlink picks", () => {
	it("WRITE-W7 a pick is what differs from the server's series, laid over them when shown, and taking it back leaves none", () => {
		const change = backlinkChangeTo(server, ["s2", "s3"], () => "시리즈 셋");
		expect(change).toEqual({ add: [{ id: "s3", title: "시리즈 셋" }], remove: ["s1"] });
		expect(backlinkShown(server, change ?? undefined).map((member) => member.title)).toEqual([
			"시리즈 둘",
			"시리즈 셋",
		]);
		expect(backlinkChangeTo(server, ["s2", "s1"], () => "")).toBeNull();
	});

	it("WRITE-W7 a write that meets a newer series reads it again and tries once more, keeping what the other save added", async () => {
		const series = {
			...ENTRY,
			id: "s1",
			collection: "collection",
			version: 1,
			working: { ...ENTRY.working, metadata: { itemIds: ["a"] } },
		};
		const { client, records } = fakeClient(ENTRY, { s1: series });
		// Someone else adds "b" between this write's read and its save.
		client.update.mockImplementationOnce(async () => {
			records.s1 = { ...series, version: 2, working: { ...series.working, metadata: { itemIds: ["a", "b"] } } };
			throw conflictError();
		});
		await writeBacklink(client, field, "s1", "entry-1", true);
		expect(records.s1?.working.metadata.itemIds).toEqual(["a", "b", "entry-1"]);
	});
});

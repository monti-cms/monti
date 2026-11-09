import { describe, expect, it } from "vitest";
import { AT_ONCE, nextToStart, problemOf, stillGoing, type Upload, uploadQueue } from "./upload-queue";

const upload = (id: string, more: Partial<Upload> = {}): Upload => ({
	id,
	name: `${id}.jpg`,
	folder: null,
	preview: null,
	status: "waiting",
	progress: 0,
	problem: null,
	...more,
});

describe("the queue of files going up", () => {
	it("09-3 files go up a few at a time, in the order they came, and the next starts when one ends", () => {
		const six = ["a", "b", "c", "d", "e", "f"].map((id) => upload(id));
		const first = nextToStart(six);
		expect(first.map((each) => each.id)).toEqual(["a", "b", "c"]);
		expect(AT_ONCE).toBe(3);
		let queue = first.reduce((list, each) => uploadQueue(list, { type: "start", id: each.id }), six);
		expect(nextToStart(queue)).toEqual([]);
		queue = uploadQueue(queue, { type: "remove", id: "a" });
		expect(nextToStart(queue).map((each) => each.id)).toEqual(["d"]);
	});

	it("09-3 progress is for a file going up, not one that has already failed", () => {
		let queue = uploadQueue([upload("a")], { type: "start", id: "a" });
		queue = uploadQueue(queue, { type: "progress", id: "a", percent: 64 });
		expect(queue[0]?.progress).toBe(64);
		queue = uploadQueue(queue, { type: "problem", id: "a", problem: "failed" });
		queue = uploadQueue(queue, { type: "progress", id: "a", percent: 90 });
		expect(queue[0]).toMatchObject({ status: "interrupted", progress: 64 });
	});

	it("09-1 a type the library does not take cannot be retried; one too big or cut off can", () => {
		const statusAfter = (problem: "type" | "unreadable" | "tooBig" | "failed") =>
			uploadQueue([upload("a")], { type: "problem", id: "a", problem })[0]?.status;
		expect(statusAfter("type")).toBe("failed");
		expect(statusAfter("unreadable")).toBe("failed");
		expect(statusAfter("tooBig")).toBe("interrupted");
		expect(statusAfter("failed")).toBe("interrupted");
	});

	it("09-1 trying again puts the file back in line", () => {
		const failed = uploadQueue([upload("a")], { type: "problem", id: "a", problem: "failed" });
		const again = uploadQueue(failed, { type: "retry", id: "a" });
		expect(again[0]).toMatchObject({ status: "waiting", problem: null });
		expect(nextToStart(again).map((each) => each.id)).toEqual(["a"]);
	});

	it("09-1 only what is still on its way holds a person back from leaving", () => {
		expect(stillGoing([upload("a")])).toHaveLength(1);
		expect(stillGoing([upload("a", { status: "uploading" })])).toHaveLength(1);
		expect(stillGoing([upload("a", { status: "failed" }), upload("b", { status: "interrupted" })])).toHaveLength(0);
		expect(stillGoing([])).toHaveLength(0);
	});

	it("09-1 the library's refusal is the file's problem", () => {
		expect(problemOf({ ok: false, reason: "type" })).toBe("type");
		expect(problemOf({ ok: false, reason: "size", mime: "image/png", kind: "image", extension: ".png" })).toBe(
			"tooBig",
		);
		expect(problemOf({ ok: true, mime: "image/png", kind: "image", extension: ".png" })).toBeNull();
	});
});

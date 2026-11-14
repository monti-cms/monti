import type { PublishTask } from "@monti-cms/core";
import { describe, expect, it } from "vitest";
import { tasksNow } from "./tasks-now";

const required = (field: string): PublishTask => ({
	code: "required",
	field,
	blocking: true,
	message: { key: "entries.task.required", values: { field } },
});
const pending: PublishTask = {
	code: "pending",
	field: "doc",
	block: "b_1",
	blocking: true,
	message: { key: "entries.task.pending" },
};
const always = () => true;

describe("the to-do list as the screen stands (TR-16)", () => {
	it("a required field filled here and not saved yet leaves the list", () => {
		expect(tasksNow([required("title"), pending], [{ field: "title", before: "", after: "제목" }], always)).toEqual([
			pending,
		]);
	});

	it("a required field emptied here joins the list, with the required rows before the others", () => {
		expect(tasksNow([pending], [{ field: "summary", before: "요약", after: "" }], always)).toEqual([
			required("summary"),
			pending,
		]);
	});

	it("an emptied field the server would not ask for stays out: not required, in another option, or a translation's field that follows its source", () => {
		expect(tasksNow([], [{ field: "videoUrl", before: "https://example.com/v", after: "" }], () => false)).toEqual([]);
	});

	it("fields nobody touched keep the server's answer: a translation's fields that are its source's are not counted as its own empty ones", () => {
		// The server already left out the source's video and link addresses; nothing typed here, nothing added.
		expect(tasksNow([pending], [], always)).toEqual([pending]);
	});

	it("a field typed into and emptied again, empty when saved too, is listed once, as the server listed it", () => {
		expect(tasksNow([required("title")], [{ field: "title", before: "", after: "" }], always)).toEqual([
			required("title"),
		]);
	});

	it("rows other than a field's emptiness are the server's, whatever is typed", () => {
		const taken: PublishTask = {
			code: "slugTaken",
			field: "slug",
			blocking: true,
			message: { key: "entries.task.slugTaken", values: { slug: "a" } },
		};
		expect(tasksNow([taken], [{ field: "slug", before: "a", after: "b" }], always)).toEqual([taken]);
	});
});

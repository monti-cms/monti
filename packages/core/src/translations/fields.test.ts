import { describe, expect, it } from "vitest";
import { defineSchema } from "../schema/define";
import { fieldMarksOf, seenAfter, trackedFields } from "./fields";

const schema = defineSchema({
	locales: { source: "ko", list: [{ code: "ko", name: "ko" }], prefix: "never" },
	collections: {
		post: {
			kind: "document",
			path: "/posts/:slug",
			fields: {
				title: { kind: "text", required: true },
				slug: { kind: "slug", required: true },
				summary: { kind: "text", locale: "perLocale" },
				subtitle: { kind: "text" },
				cover: { kind: "media" },
				category: { kind: "relation", to: "tag", locale: "perLocale" },
			},
		},
		tag: {
			kind: "item",
			fields: { title: { kind: "text", required: true }, slug: { kind: "slug", required: true } },
		},
	},
});

describe("what a translation holds of its own", () => {
	it("04-2 T111 T119 is the title, a field per language and a media field: not the address, a shared field, a relation or an item's", () => {
		expect(trackedFields(schema, "post")).toEqual(["title", "summary", "cover"]);
		expect(trackedFields(schema, "tag")).toEqual([]);
	});

	it("04-2 T111 keeps what it saw until it is confirmed, sees the source when a field becomes its own, and forgets it when emptied", () => {
		const tracked = ["title", "summary", "cover"];
		const followed = { title: "새 제목", values: { summary: "새 요약" } };
		expect(
			seenAfter(
				tracked,
				{ title: "옛 제목", summary: "옛 요약" },
				{ title: "Mine", values: { cover: { media: "m" } } },
				followed,
			),
		).toEqual({ title: "옛 제목", cover: null });
	});

	it("04-2 T111 a value that says the same thing in another key order is no change; an emptied one is", () => {
		const seen = { cover: { media: "m", alt: "책상" }, summary: "요약" };
		expect(fieldMarksOf(seen, { title: "", values: { cover: { alt: "책상", media: "m" }, summary: "" } })).toEqual([
			{ field: "summary", before: "요약", after: null },
		]);
		expect(fieldMarksOf(seen, null)).toEqual([]);
	});
});

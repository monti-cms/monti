// @vitest-environment jsdom
import type { EntryForm } from "@monti-cms/admin/hooks";
import { defineSite } from "@monti-cms/core";
import { createSite, SiteProvider } from "@monti-cms/core/client";
import { emptyStoredDocument } from "@monti-cms/core/document";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { schema } from "../site";
import { readingTime, readingTimeField } from "./index";
import { readingMinutes } from "./reading-time";
import { ReadingTimeView } from "./view";

afterEach(cleanup);

const site = createSite(
	defineSite({
		schema: {
			...schema,
			collections: {
				...schema.collections,
				post: {
					...schema.collections.post,
					fields: { ...schema.collections.post.fields, readingTime: readingTimeField },
				},
			},
		},
		plugins: [readingTime()],
	}),
);

const bodyOf = (words: number): EntryForm["doc"] => ({
	...emptyStoredDocument(),
	content: [
		{ type: "paragraph", content: [{ type: "text", text: Array.from({ length: words }, () => "word").join(" ") }] },
	],
});

const showing = (form: Partial<EntryForm>) => (
	<SiteProvider site={site}>
		<ReadingTimeView collection="post" form={{ slug: "", doc: bodyOf(0), ...form }} entry={null} />
	</SiteProvider>
);

describe("reading time", () => {
	it("rounds up, and says one minute at least", () => {
		expect(readingMinutes("")).toBe(1);
		expect(readingMinutes("word ".repeat(200))).toBe(1);
		expect(readingMinutes("word ".repeat(201))).toBe(2);
	});

	it("counts the words of a language without spaces", () => {
		expect(readingMinutes("안녕하세요 오늘은 날씨가 좋습니다 ".repeat(100), "ko")).toBe(2);
	});

	it("shows a value computed from the body being edited, and follows it", () => {
		const { rerender } = render(showing({ doc: bodyOf(450) }));
		expect(screen.getByText("3 min read")).toBeTruthy();
		rerender(showing({ doc: bodyOf(30) }));
		expect(screen.getByText("1 min read")).toBeTruthy();
	});

	it("the field is a view field, so nothing is stored for it", () => {
		expect(site.schemaOf("post").fields.readingTime).toMatchObject({ kind: "view", view: "reading-time" });
		expect(site.storedFields("post").map((stored) => stored.name)).not.toContain("readingTime");
	});
});

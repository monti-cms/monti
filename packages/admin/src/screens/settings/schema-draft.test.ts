import { describe, expect, it } from "vitest";
import { schema } from "../story-schema";
import { at, build, flatten, type SettingsRead, settingsVersion } from "./schema-draft";

const read: SettingsRead = {
	site: { name: "example.dev", writingStyle: "", version: 3 },
	admin: { language: "ko", templates: true, version: 1 },
	schema,
	hash: "h",
	version: 7,
	adminValues: {
		post: { label: "게시글", fields: { summary: { label: "요약" } }, list: { widths: { summary: 200 } }, version: 4 },
	},
	locked: false,
	fileChanged: false,
	failedChange: null,
};

describe("the settings draft's version", () => {
	it("12-1 is the same after a list's column was dragged: the changes this browser kept are not thrown away by what the settings do not edit", () => {
		const dragged: SettingsRead = {
			...read,
			adminValues: { post: { ...read.adminValues.post, list: { widths: { summary: 320 }, pageSize: 50 }, version: 5 } },
		};
		expect(settingsVersion(dragged)).toBe(settingsVersion(read));
		// The admin's own preferences are not part of the draft either.
		expect(settingsVersion({ ...read, admin: { language: "en", templates: false, version: 2 } })).toBe(
			settingsVersion(read),
		);
	});

	it("12-1 is the same whether a collection has no admin values yet or only a list's look: the first column dragged does not drop the kept changes", () => {
		const none: SettingsRead = { ...read, adminValues: {} };
		const listOnly: SettingsRead = {
			...read,
			adminValues: { post: { list: { widths: { summary: 320 } }, version: 1 } },
		};
		expect(settingsVersion(listOnly)).toBe(settingsVersion(none));
		// Empty values of something the draft edits, and a value at what it is by default, are no values either.
		expect(settingsVersion({ ...read, adminValues: { post: { fields: {}, version: 2 } } })).toBe(settingsVersion(none));
		expect(settingsVersion({ ...read, adminValues: { post: { folders: false, version: 3 } } })).toBe(
			settingsVersion(none),
		);
		expect(settingsVersion({ ...read, adminValues: { post: { folders: true, version: 3 } } })).not.toBe(
			settingsVersion(none),
		);
	});

	it("12-1 is another once something the draft edits was saved: a label, the site's name, the languages", () => {
		const base = settingsVersion(read);
		expect(
			settingsVersion({ ...read, adminValues: { post: { ...read.adminValues.post, label: "글", version: 5 } } }),
		).not.toBe(base);
		expect(settingsVersion({ ...read, site: { ...read.site, name: "example.blog" } })).not.toBe(base);
		expect(
			settingsVersion({ ...read, schema: { ...schema, locales: { ...schema.locales, prefix: "always" } } }),
		).not.toBe(base);
	});
});

describe("a conditional field in the draft (doc 19)", () => {
	const format = {
		kind: "conditional" as const,
		required: true,
		options: ["article", "video", "link"],
		fields: {
			video: { videoUrl: { kind: "text" as const, required: true } },
			link: { linkUrl: { kind: "text" as const } },
		},
	};
	const post = schema.collections.post as NonNullable<typeof schema.collections.post>;
	const withFormat: SettingsRead = {
		...read,
		schema: {
			...schema,
			collections: { ...schema.collections, post: { ...post, fields: { ...post.fields, format } } },
		},
	};
	const base = flatten(withFormat, null);
	const made = (mine: Record<string, unknown>) =>
		build(withFormat, Object.keys(mine), (path) => (path in mine ? mine[path] : base[path]), null);

	it("19-6 is held as its choice and, each on its own, the fields of its options; built again it is the schema it was", () => {
		expect(base[at.field("post", "format")]).toEqual({ name: "format", def: { ...format, fields: {} } });
		expect(base[at.field("post", "videoUrl")]).toEqual({
			name: "videoUrl",
			def: { kind: "text", required: true },
			under: { field: "format", option: "video" },
		});
		expect(made({}).schema).toEqual(withFormat.schema);
		expect(made({}).renames).toEqual([]);
	});

	it("19-6 a rule changed on the choice keeps the options' fields; a field added to an option joins it; a renamed one is a rename", () => {
		const changed = made({
			[at.field("post", "format")]: { name: "kind", def: { kind: "conditional", options: format.options, fields: {} } },
			[at.field("post", "credit")]: {
				name: "credit",
				def: { kind: "text" },
				under: { field: "format", option: "article" },
			},
			[at.field("post", "linkUrl")]: {
				name: "href",
				def: { kind: "text" },
				under: { field: "format", option: "link" },
			},
		});
		expect(changed.schema.collections.post?.fields.kind).toEqual({
			kind: "conditional",
			options: format.options,
			fields: { article: { credit: { kind: "text" } }, video: format.fields.video, link: { href: { kind: "text" } } },
		});
		expect(changed.renames).toEqual([
			{ collection: "post", from: "format", to: "kind" },
			{ collection: "post", from: "linkUrl", to: "href" },
		]);
	});

	it("19-6 an option taken out takes its fields out of the schema, and the layout never places an option's field", () => {
		const changed = made({
			[at.field("post", "format")]: { name: "format", def: { ...format, options: ["article", "link"], fields: {} } },
			[at.collectionValue("post", "layout")]: [{ tab: "기본", fields: ["slug"] }],
		});
		expect(changed.schema.collections.post?.fields.format).toEqual({
			...format,
			options: ["article", "link"],
			fields: { link: format.fields.link },
		});
		const placed = changed.adminValues.post?.layout?.flatMap((tab) => tab.fields);
		expect(placed).toContain("format");
		expect(placed).not.toContain("linkUrl");
		expect(placed).not.toContain("videoUrl");
	});
});

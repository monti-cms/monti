import { describe, expect, it } from "vitest";
import { schema } from "../story-schema";
import { type SettingsRead, settingsVersion } from "./schema-draft";

const read: SettingsRead = {
	site: { name: "example.dev", writing: "", version: 3 },
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

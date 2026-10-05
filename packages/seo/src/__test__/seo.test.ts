import { type CollectionsConfig, defineCollection, fields, valueFieldsOf } from "@monti-cms/core";
import { COLLECTIONS, cmsConfig, createTranslator, roleField, schemaOf } from "@monti-cms/core/client";
import { describe, expect, it } from "vitest";
import { AI_ACTIONS } from "../../../ai/src/registry";
import { SEO_ROLES, seo, seoFields, seoOf, validateSeoFields } from "..";
import { seoMessages } from "../messages";

/**
 * SEO extension. The field set, config validation and public page helper are tested with definitions built inside the tests; the AI features are checked with fields found by role in the current config (both the example blog and
 * the other site).
 */

describe("seoFields", () => {
	it("builds the field set with default names and roles", () => {
		const bundle = seoFields();
		expect(bundle.seoTitle).toMatchObject({ kind: "text", role: SEO_ROLES.title, localized: true });
		expect(bundle.seoImage).toMatchObject({ kind: "media", accept: "image", role: SEO_ROLES.image });
		expect(bundle.seoNoindex).toMatchObject({ kind: "select", role: "noindex", defaultValue: "index" });
		// Hiding is always a shared value.
		expect(bundle.seoNoindex.localized).toBeUndefined();
		expect(bundle.seoPreview).toMatchObject({ kind: "view", view: "search" });
	});

	it("default labels are chosen in the admin language at read time, not when the field is built (labels set by the site stay as is)", () => {
		const t = createTranslator(seoMessages);
		const bundle = seoFields({ labels: { canonical: "Canonical" } });
		expect(bundle.seoTitle.label).toBe(t("field.title"));
		expect(bundle.seoImage.label).toBe(t("field.image"));
		expect(bundle.seoNoindex.label).toBe(t("field.noindex"));
		expect(bundle.seoNoindex.options).toEqual({ index: t("option.index"), noindex: t("option.noindex") });
		expect(bundle.seoCanonical.label).toBe("Canonical");
		// Every language dictionary has the same labels as English.
		const missing = Object.keys(seoMessages.messages.en).filter((key) => !(key in (seoMessages.messages.ko ?? {})));
		expect(missing.every((key) => key.endsWith(".prompt"))).toBe(true);
	});

	it("changes names, labels, tab, per-language values and recommended lengths, and omits slots (stored names are kept as they are)", () => {
		const bundle = seoFields({
			keys: { title: "metaTitle", image: "ogImageId" },
			labels: { title: "Meta title" },
			tab: "Search",
			localized: false,
			limits: { title: 70 },
			omit: ["canonical", "preview"],
		});
		expect(Object.keys(bundle)).toEqual(["metaTitle", "seoDescription", "ogImageId", "seoNoindex"]);
		expect(bundle.metaTitle).toMatchObject({ label: "Meta title", tab: "Search", inputOptions: { limit: 70 } });
		expect(bundle.metaTitle.localized).toBeUndefined();
	});
});

describe("config validation (`seo().validate`)", () => {
	const title = fields.text({ label: "Title" });
	const check = (extra: Parameters<typeof defineCollection>[0]["fields"]) => () =>
		validateSeoFields({
			collections: {
				page: defineCollection({
					label: "Page",
					kind: "document",
					fields: { title, ...extra },
					list: { columns: [] },
				}),
			} as CollectionsConfig,
		});

	it("checks that SEO roles are attached to fields of the right kind", () => {
		expect(check(seoFields())).not.toThrow();
		expect(check({ image: fields.text({ label: "Image", role: "ogImage" }) })).toThrow(/needs a media field/);
		expect(check({ t: fields.media({ label: "T", role: "seoTitle" }) })).toThrow(/needs a text field/);
		expect(
			check({ robots: fields.select({ label: "R", role: "noindex", options: { a: "A" }, defaultValue: "a" }) }),
		).toThrow(/"noindex" option/);
		expect(seo().validate).toBe(validateSeoFields);
	});
});

describe("public page helper (`seoOf`)", () => {
	const page = defineCollection({
		label: "Page",
		kind: "document",
		fields: {
			title: fields.text({ label: "Title" }),
			intro: fields.text({ label: "Intro", role: "summary" }),
			...seoFields({ keys: { title: "metaTitle", noindex: "robots" } }),
		},
		list: { columns: [] },
	});

	it("reads values by role and fills an empty title or description from the title or summary", () => {
		expect(seoOf(page, { title: "Page", intro: "Intro text" })).toEqual({
			title: "Page",
			description: "Intro text",
			noindex: false,
		});
		expect(
			seoOf(page, {
				title: "Page",
				metaTitle: " Search title ",
				seoDescription: "Search text",
				seoImage: "11111111-1111-4111-8111-111111111111",
				seoCanonical: "https://a.dev/x",
				robots: "noindex",
			}),
		).toEqual({
			title: "Search title",
			description: "Search text",
			imageId: "11111111-1111-4111-8111-111111111111",
			canonical: "https://a.dev/x",
			noindex: true,
		});
	});
});

describe("current config: AI features", () => {
	/** The (collection, field) pairs that have that role field. */
	const withRole = (role: string) =>
		COLLECTIONS.flatMap((collection) => {
			const stored = roleField(collection, role);
			return stored ? [`${collection}.${stored.name}`] : [];
		}).sort();
	const pairs = (key: string) =>
		(AI_ACTIONS[key]?.attach ?? [])
			.flatMap((attach) =>
				attach.slot === "field" ? (attach.collections ?? []).map((collection) => `${collection}.${attach.field}`) : [],
			)
			.sort();

	it("with the AI plugin, search title and description suggestions attach to the role fields (even if not listed in the AI config)", () => {
		expect(withRole(SEO_ROLES.title).length).toBeGreaterThan(0);
		expect(pairs("seoTitle")).toEqual(withRole(SEO_ROLES.title));
		expect(pairs("seoDescription")).toEqual(withRole(SEO_ROLES.description));
	});

	it("suggestion length is field `max` → recommended length (`limits`) → default", () => {
		const collection = COLLECTIONS.find((name) => roleField(name, SEO_ROLES.title));
		const field = collection ? roleField(collection, SEO_ROLES.title)?.field : undefined;
		const limit = field?.kind === "text" ? (field.max ?? field.inputOptions?.limit ?? 60) : 60;
		expect(AI_ACTIONS.seoTitle?.checks).toEqual([{ kind: "maxLength", max: limit }]);
		expect(AI_ACTIONS.seoTitle?.prompt).toContain(`${limit} characters`);
	});

	it("all SEO fields are in their own tab", () => {
		for (const collection of COLLECTIONS) {
			for (const { name, field } of valueFieldsOf(schemaOf(collection))) {
				if (Object.values(SEO_ROLES).includes(field.role as never)) expect(field.tab, name).toBeTruthy();
			}
		}
		expect(cmsConfig.plugins?.some((plugin) => plugin.name === "seo")).toBe(true);
	});
});

import { type CollectionsConfig, defineCollection, defineSite, fields } from "@monti-cms/core";
import { createSite, fieldSetsOf, hasFieldSet, valueFieldsOf } from "@monti-cms/core/site";
import { describe, expect, it } from "vitest";
import { aiRegistryOf } from "../../../ai/src/registry";
import { testConfig, testSite } from "../../test/site";
import { checkSeoFields, SEO_ROLES, seo, seoFields, seoOf } from "..";
import { seoMessages } from "../messages";

/**
 * SEO extension. The field set, config validation and public page helper are tested with definitions built inside the tests; the AI features are checked with fields found by role in the current config (both the example blog and
 * the other site).
 */

describe("seoFields", () => {
	it("SITE-N2 builds the field set with default names and roles", () => {
		const bundle = seoFields();
		expect(bundle.seoTitle).toMatchObject({ kind: "text", role: SEO_ROLES.title, localized: true });
		expect(bundle.seoImage).toMatchObject({ kind: "media", accept: "image", role: SEO_ROLES.image });
		expect(bundle.seoNoindex).toMatchObject({ kind: "select", role: "noindex", defaultValue: "index" });
		// Hiding is always a shared value.
		expect(bundle.seoNoindex.localized).toBeUndefined();
	});

	it("SITE-N2 default labels are chosen in the admin language at read time, not when the field is built (labels set by the site stay as is)", () => {
		const seoBundle = seoFields({ labels: { canonical: "Canonical" } });
		const page = defineCollection({
			label: "Page",
			kind: "document",
			fields: { title: fields.text({ label: "Title" }), ...seoBundle },
		});
		// The labels are read when a site is created from the config, in that site's admin language.
		const site = createSite(defineSite({ ...testConfig, collections: { page } as CollectionsConfig }));
		const t = site.createTranslator(seoMessages);
		const bundle = site.schemaOf("page").fields as unknown as typeof seoBundle;
		expect(bundle.seoTitle.label).toBe(t("field.title"));
		expect(bundle.seoImage.label).toBe(t("field.image"));
		expect(bundle.seoNoindex.label).toBe(t("field.noindex"));
		expect(bundle.seoNoindex.options).toEqual({ index: t("option.index"), noindex: t("option.noindex") });
		expect(bundle.seoCanonical.label).toBe("Canonical");
		// Every language dictionary has the same labels as English.
		const missing = Object.keys(seoMessages.messages.en).filter((key) => !(key in (seoMessages.messages.ko ?? {})));
		expect(missing).toEqual([]);
	});

	it("SITE-N2 changes names, labels, per-language values and recommended lengths, and omits slots (stored names are kept as they are)", () => {
		const bundle = seoFields({
			keys: { title: "metaTitle", image: "ogImageId" },
			labels: { title: "Meta title" },
			localized: false,
			limits: { title: 70 },
			omit: ["canonical"],
		});
		expect(Object.keys(bundle)).toEqual(["metaTitle", "seoDescription", "ogImageId", "seoNoindex"]);
		expect(bundle.metaTitle).toMatchObject({ label: "Meta title", inputOptions: { limit: 70 } });
		expect(bundle.metaTitle.localized).toBeUndefined();
	});
});

describe("config validation (`seo().checkConfig`)", () => {
	const title = fields.text({ label: "Title" });
	const check = (extra: Parameters<typeof defineCollection>[0]["fields"]) =>
		checkSeoFields({
			collections: {
				page: defineCollection({
					label: "Page",
					kind: "document",
					fields: { title, ...extra },
				}),
			} as CollectionsConfig,
		});

	it("SITE-N2 checks that SEO roles are attached to fields of the right kind", () => {
		expect(check(seoFields())).toEqual([]);
		expect(check({ image: fields.text({ label: "Image", role: "ogImage" }) })).toEqual([
			expect.objectContaining({ path: "collections.page.fields.image.role", code: "role-kind" }),
		]);
		expect(check({ t: fields.media({ label: "T", role: "seoTitle" }) })).toEqual([
			expect.objectContaining({ path: "collections.page.fields.t.role", code: "role-kind" }),
		]);
		expect(
			check({ robots: fields.select({ label: "R", role: "noindex", options: { a: "A" }, defaultValue: "a" }) }),
		).toEqual([expect.objectContaining({ path: "collections.page.fields.robots.role", code: "role-kind" })]);
		expect(seo().checkConfig).toBe(checkSeoFields);
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
	});

	it("SITE-N2 reads values by role and fills an empty title or description from the title or summary", () => {
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

	it("SITE-N2 falls back to the title field found by its role, not by the name `title`", () => {
		const article = defineCollection({
			label: "Article",
			kind: "document",
			fields: {
				headline: fields.text({ label: "Headline", role: "title" }),
				...seoFields(),
			},
		});
		expect(seoOf(article, { headline: "Article headline" })).toMatchObject({ title: "Article headline" });
		// A stored `title` that is not the title field is not the fallback.
		expect(seoOf(article, { headline: "", title: "Not the title" }).title).toBeUndefined();
	});
});

describe("current config: AI features", () => {
	const actions = aiRegistryOf(testSite).actions;
	/** The (collection, field) pairs that have that role field. */
	const withRole = (role: string) =>
		testSite.COLLECTIONS.flatMap((collection) => {
			const stored = testSite.roleField(collection, role);
			return stored ? [`${collection}.${stored.name}`] : [];
		}).sort();
	const pairs = (key: string) =>
		(actions[key]?.attach ?? [])
			.flatMap((attach) =>
				attach.slot === "field" ? (attach.collections ?? []).map((collection) => `${collection}.${attach.field}`) : [],
			)
			.sort();

	it("SITE-N2 with the AI plugin, search title and description suggestions attach to the role fields (even if not listed in the AI config)", () => {
		expect(withRole(SEO_ROLES.title).length).toBeGreaterThan(0);
		expect(pairs("seoTitle")).toEqual(withRole(SEO_ROLES.title));
		expect(pairs("seoDescription")).toEqual(withRole(SEO_ROLES.description));
	});

	it("SITE-N2 suggestion length is field `max` → recommended length (`limits`) → default", () => {
		const collection = testSite.COLLECTIONS.find((name) => testSite.roleField(name, SEO_ROLES.title));
		const field = collection ? testSite.roleField(collection, SEO_ROLES.title)?.field : undefined;
		const limit = field?.kind === "text" ? (field.max ?? field.inputOptions?.limit ?? 60) : 60;
		expect(actions.seoTitle?.checks).toEqual([{ kind: "maxLength", max: limit }]);
		expect(actions.seoTitle?.prompt).toContain(`${limit} characters`);
	});

	it("SITE-N2 the plugin places every SEO field in a tab of its own, found by role and by the preview view", () => {
		for (const collection of testSite.COLLECTIONS) {
			const placed = testSite.panelGroupsOf(collection).find((group) => group.placedBy === "seo");
			for (const { name, field } of valueFieldsOf(testSite.schemaOf(collection))) {
				if (Object.values(SEO_ROLES).includes(field.role as never)) expect(placed?.fields, name).toContain(name);
			}
		}
		expect(testSite.plugins?.some((plugin) => plugin.name === "seo")).toBe(true);
	});

	it("SITE-N2 takes the tab name from the plugin options, and places nothing in a collection without SEO fields", () => {
		const layout = (tab?: string) => seo(tab ? { tab } : {}).contributes?.layout;
		expect(layout()).toEqual([expect.objectContaining({ tab: "SEO" })]);
		expect(layout("Search")).toEqual([expect.objectContaining({ tab: "Search" })]);
		expect(seo({ ai: false }).contributes).not.toHaveProperty("ai");
	});

	it("SITE-N2 offers its fields to the settings screen as a field set of plain data, found in a collection by role", () => {
		const [set] = fieldSetsOf([{ name: "seo", contributes: seo().contributes }]);
		expect(set).toMatchObject({ id: "seo", label: "SEO", plugin: "seo" });
		expect(set?.roles).toEqual(Object.values(SEO_ROLES));
		expect(Object.keys(set?.fields ?? {})).toEqual(Object.keys(seoFields()));
		// Plain data: it survives the trip to the browser and the schema file unchanged.
		expect(JSON.parse(JSON.stringify(set?.fields))).toMatchObject({
			seoTitle: { kind: "text", role: SEO_ROLES.title },
		});
		expect(hasFieldSet(set as NonNullable<typeof set>, set?.fields ?? {})).toBe(true);
		expect(hasFieldSet(set as NonNullable<typeof set>, { title: { kind: "text" } })).toBe(false);
	});
});

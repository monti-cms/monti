import { describe, expect, it } from "vitest";
import { ConfigError, type ConfigIssue, defineCollection, definePlugin, defineSite, fields } from "../..";
import { createSite } from "../../site";

const title = fields.text({ label: "Title" });
const slug = fields.slug({ label: "Slug", from: "title" });
const topic = defineCollection({ label: "Topic", kind: "item", fields: { title, slug } });
const locales = [{ code: "en", name: "English" }];

/** The issues a config is rejected with (none when it is accepted). */
const issuesOf = (run: () => unknown): ConfigIssue[] => {
	try {
		run();
	} catch (error) {
		if (error instanceof ConfigError) return [...error.issues];
		throw error;
	}
	return [];
};
/** The config is rejected with an issue at `path` of the kind `code`. */
const expectIssue = (run: () => unknown, path: string, code: string) =>
	expect(issuesOf(run)).toContainEqual(expect.objectContaining({ path, code }));

describe("defineSite", () => {
	it("returns the config with collections normalized (kind, body)", () => {
		const config = { collections: { topic }, locales, defaultLocale: "en" } as const;
		const defined = defineSite(config);
		expect(defined).toEqual(config);
		expect(defined.collections.topic).toMatchObject({ kind: "item", body: false });
	});

	it("rejects a definition without a kind", () => {
		expectIssue(
			() =>
				defineSite({
					collections: { bad: { label: "Bad", fields: { title, slug } } as unknown as typeof topic },
					locales,
					defaultLocale: "en",
				}),
			"collections.bad.kind",
			"enum",
		);
	});

	it("rejects an option the format does not have, whichever way the collection is written", () => {
		const retired = { label: "Old", kind: "item", workflow: "record", fields: { title, slug } } as never;
		expectIssue(
			() => defineSite({ collections: { old: retired }, locales, defaultLocale: "en" }),
			"collections.old.workflow",
			"unknown-key",
		);
		const viaDefine = defineCollection(retired);
		expectIssue(
			() => defineSite({ collections: { old: viaDefine }, locales, defaultLocale: "en" }),
			"collections.old.workflow",
			"unknown-key",
		);
		const list = { label: "Old", kind: "item", list: { columns: ["title"] }, fields: { title, slug } } as never;
		expectIssue(
			() => defineSite({ collections: { old: list }, locales, defaultLocale: "en" }),
			"collections.old.list",
			"unknown-key",
		);
	});

	it("names the closest option when a key is misspelt, at every level", () => {
		const base = { collections: { topic }, locales, defaultLocale: "en" } as const;
		const hint = (run: () => unknown, path: string) => issuesOf(run).find((issue) => issue.path === path)?.message;
		expect(hint(() => defineSite({ ...base, plugin: [] } as never), "plugin")).toContain('did you mean "plugins"');
		expect(hint(() => defineSite({ ...base, site: { localePrefx: "always" } } as never), "site.localePrefx")).toContain(
			'did you mean "localePrefix"',
		);
		const typo = { ...topic, fields: { title, slug: { ...slug, frm: "title" } } };
		expect(
			hint(
				() => defineSite({ collections: { topic: typo as never }, locales, defaultLocale: "en" }),
				"collections.topic.fields.slug.frm",
			),
		).toContain('did you mean "from"');
	});

	it('rejects the removed `required: "publish"`: only `true` exists', () => {
		const old = defineCollection({
			label: "Old",
			kind: "document",
			fields: { title: { ...title, required: "publish" } as never, slug },
		});
		expectIssue(
			() => defineSite({ collections: { old }, locales, defaultLocale: "en" }),
			"collections.old.fields.title.required",
			"enum",
		);
	});

	it("reports every problem at once, not only the first", () => {
		const issues = issuesOf(() =>
			defineSite({
				collections: { topic },
				locales: [{ code: "EN", name: "English" }],
				defaultLocale: "xx" as "EN",
				timeZone: "Mars/Base",
				site: { url: "example.com" },
			}),
		);
		expect(issues.map((issue) => issue.path).sort()).toEqual([
			"defaultLocale",
			"locales[0].code",
			"site.url",
			"timeZone",
		]);
	});

	it("rejects collection paths that can make the same URL", () => {
		const page = (path: `/${string}:slug${string}`) =>
			defineCollection({ label: "Page", kind: "document", path, fields: { title, slug } });
		expect(() =>
			defineSite({
				collections: { post: page("/posts/:slug"), archive: page("/posts/archive-:slug") },
				locales,
				defaultLocale: "en",
			}),
		).toThrow(ConfigError);
		expectIssue(
			() =>
				defineSite({
					collections: { post: page("/posts/:slug"), archive: page("/posts/archive-:slug") },
					locales,
					defaultLocale: "en",
				}),
			"collections.archive.path",
			"path-overlap",
		);
		expect(() =>
			defineSite({
				collections: { post: page("/posts/:slug"), memo: page("/memos/:slug") },
				locales,
				defaultLocale: "en",
			}),
		).not.toThrow();
	});

	it("rejects a field named like a reserved metadata key (`translations`)", () => {
		const collection = defineCollection({
			label: "Reserved",
			kind: "item",
			fields: { title, slug, translations: fields.text({ label: "Translations" }) },
		});
		expectIssue(
			() => defineSite({ collections: { collection }, locales, defaultLocale: "en" }),
			"collections.collection.fields.translations",
			"reserved-name",
		);
	});

	it("rejects locale codes that are not BCP 47 shaped (they go into URLs and SQL defaults)", () => {
		for (const code of ["pt-BR", "zh-Hant", "ko"]) {
			expect(() =>
				defineSite({ collections: { topic }, locales: [{ code, name: code }], defaultLocale: code }),
			).not.toThrow();
		}
		for (const code of ["EN", "en_US", "e'n", "english language"]) {
			expectIssue(
				() => defineSite({ collections: { topic }, locales: [{ code, name: code }], defaultLocale: code }),
				"locales[0].code",
				"locale-code",
			);
		}
	});

	it("checks the admin locale and fillFromBody.maxLength", () => {
		expectIssue(
			() => defineSite({ collections: { topic }, locales, defaultLocale: "en", admin: { locale: "not a locale!" } }),
			"admin.locale",
			"locale",
		);
		const article = defineCollection({
			label: "Article",
			kind: "document",
			fields: { title, summary: fields.text({ label: "Summary", fillFromBody: { maxLength: 0 } }) },
		});
		expectIssue(
			() => defineSite({ collections: { article }, locales, defaultLocale: "en" }),
			"collections.article.fields.summary.fillFromBody.maxLength",
			"range",
		);
	});

	describe("editor.widths", () => {
		const base = { collections: { topic }, locales, defaultLocale: "en" } as const;
		const withWidths = (widths: { label: string; width: string }[]) => defineSite({ ...base, editor: { widths } });

		it("keeps the steps in the order written, and the config works without them", () => {
			const widths = [
				{ label: "Desktop", width: "720px" },
				{ label: "Phone", width: "375px" },
			];
			expect(withWidths(widths).editor?.widths).toEqual(widths);
			expect(defineSite(base).editor).toBeUndefined();
		});

		it("accepts CSS lengths of every common shape", () => {
			for (const width of [
				"720px",
				"48rem",
				"60ch",
				"80%",
				"37.5em",
				".5rem",
				"min(100%, 60ch)",
				"calc(100vw - 2rem)",
			]) {
				expect(() => withWidths([{ label: "A", width }]), width).not.toThrow();
			}
		});

		it("rejects empty or invalid widths, naming the step", () => {
			for (const width of ["", "  ", "720", "wide", "px", "-5px", "10px; color: red", "url(x)", "720 px"]) {
				expectIssue(() => withWidths([{ label: "A", width }]), "editor.widths[0].width", "css-length");
			}
		});

		it("rejects empty and repeated labels and an empty list", () => {
			expectIssue(() => withWidths([{ label: " ", width: "720px" }]), "editor.widths[0].label", "empty");
			expectIssue(
				() =>
					withWidths([
						{ label: "A", width: "720px" },
						{ label: "A", width: "375px" },
					]),
				"editor.widths[1].label",
				"duplicate",
			);
			expectIssue(() => withWidths([]), "editor.widths", "empty");
		});

		it("reaches the browser snapshot", () => {
			const widths = [{ label: "Desktop", width: "720px" }];
			expect(createSite(withWidths(widths)).snapshot().editor?.widths).toEqual(widths);
		});
	});

	it("checks the admin path, locale prefix, preview locale param", () => {
		const base = { collections: { topic }, locales, defaultLocale: "en" } as const;
		expect(() => defineSite({ ...base, admin: { path: "/studio" } })).not.toThrow();
		expect(() => defineSite({ ...base, admin: { path: "/cms/admin" } })).not.toThrow();
		for (const path of ["/", "admin", "/admin/", "/api/admin", "/a b"]) {
			expectIssue(() => defineSite({ ...base, admin: { path } }), "admin.path", "admin-path");
		}
		expect(() => defineSite({ ...base, site: { localePrefix: "always" } })).not.toThrow();
		expectIssue(
			() => defineSite({ ...base, site: { localePrefix: "sometimes" as "always" } }),
			"site.localePrefix",
			"enum",
		);
		expect(() => defineSite({ ...base, site: { previewLocaleParam: false } })).not.toThrow();
		expect(() => defineSite({ ...base, site: { previewLocaleParam: "lang" } })).not.toThrow();
		expectIssue(
			() => defineSite({ ...base, site: { previewLocaleParam: "a b" } }),
			"site.previewLocaleParam",
			"query-name",
		);
	});

	it("rejects a default locale outside the list and duplicate locales", () => {
		expectIssue(
			() => defineSite({ collections: { topic }, locales, defaultLocale: "ko" as "en" }),
			"defaultLocale",
			"unknown-locale",
		);
		expectIssue(
			() => defineSite({ collections: { topic }, locales: [...locales, ...locales], defaultLocale: "en" }),
			"locales[1].code",
			"duplicate",
		);
	});

	it("rejects relations and backlinks to unknown or mismatched collections", () => {
		const article = defineCollection({
			label: "Article",
			kind: "document",
			fields: { title, topicId: fields.relation({ label: "Topic", to: "missing" }) },
		});
		expectIssue(
			() => defineSite({ collections: { article }, locales, defaultLocale: "en" }),
			"collections.article.fields.topicId.to",
			"unknown-collection",
		);

		const series = defineCollection({
			label: "Series",
			kind: "item",
			fields: { title, articleId: fields.relation({ label: "Article", to: "article" }) },
		});
		const linked = defineCollection({
			label: "Article",
			kind: "document",
			fields: { title, series: fields.backlink({ label: "Series", from: "series", via: "articleId" }) },
		});
		// Without a to-many `via`, the inverse relation cannot be created.
		expectIssue(
			() => defineSite({ collections: { article: linked, series }, locales, defaultLocale: "en" }),
			"collections.article.fields.series.via",
			"backlink-via",
		);
	});

	it("checks the public path pattern and site URL", () => {
		const withPath = (path: string) => ({ ...topic, path }) as typeof topic & { path: `/${string}:slug${string}` };
		expect(() =>
			defineSite({ collections: { topic: withPath("/topics/:slug") }, locales, defaultLocale: "en" }),
		).not.toThrow();
		for (const path of ["topics/:slug", "/topics", "/:slug/:slug", "/:lang/:slug", "/t/:slug?x"]) {
			expectIssue(
				() => defineSite({ collections: { topic: withPath(path) }, locales, defaultLocale: "en" }),
				"collections.topic.path",
				path.startsWith("/") ? "path-slug" : "path-slash",
			);
		}
		const noSlug = defineCollection({
			label: "Note",
			kind: "document",
			path: "/notes/:slug",
			fields: { title },
		});
		expectIssue(
			() => defineSite({ collections: { noSlug }, locales, defaultLocale: "en" }),
			"collections.noSlug.path",
			"path-needs-slug",
		);
		expectIssue(
			() => defineSite({ collections: { topic }, locales, defaultLocale: "en", site: { url: "example.com" } }),
			"site.url",
			"http-url",
		);
	});

	it("checks that a seed template has a document, or a text with its format", () => {
		const base = { collections: { topic }, locales, defaultLocale: "en" } as const;
		const id = "00000000-0000-4000-8000-000000000001";
		const doc = { type: "doc", version: 3, content: [] } as const;
		expect(() => defineSite({ ...base, seed: { templates: [{ id, name: "Note", doc }] } })).not.toThrow();
		const neither = { id, name: "Note" } as never;
		expectIssue(() => defineSite({ ...base, seed: { templates: [neither] } }), "seed.templates[0]", "shape");
		const textWithoutFormat = { id, name: "Note", body: "x" } as never;
		expectIssue(() => defineSite({ ...base, seed: { templates: [textWithoutFormat] } }), "seed.templates[0]", "shape");
		const both = { id, name: "Note", doc, body: "x", format: "mdx" } as never;
		expectIssue(() => defineSite({ ...base, seed: { templates: [both] } }), "seed.templates[0]", "shape");
	});

	it("checks seed template ids", () => {
		const template = { id: "00000000-0000-4000-8000-000000000001", name: "Note", format: "mdx", body: "" };
		const base = { collections: { topic }, locales, defaultLocale: "en" } as const;
		expect(() => defineSite({ ...base, seed: { templates: [template] } })).not.toThrow();
		expectIssue(
			() => defineSite({ ...base, seed: { templates: [{ ...template, id: "1" }] } }),
			"seed.templates[0].id",
			"uuid",
		);
		expectIssue(
			() => defineSite({ ...base, seed: { templates: [template, { ...template, name: "Other" }] } }),
			"seed.templates[1].id",
			"duplicate",
		);
	});

	it("checks layout tab names and view field names", () => {
		const note = (extra: { view?: string; tab?: string }) =>
			defineCollection({
				label: "Note",
				kind: "item",
				fields: {
					title: fields.text({ label: "Title" }),
					preview: fields.view({ view: extra.view ?? "search" }),
				},
				layout: [{ fields: ["title", "preview"], ...(extra.tab !== undefined ? { tab: extra.tab } : {}) }],
			});
		expect(() =>
			defineSite({ collections: { note: note({ tab: "검색" }) }, locales, defaultLocale: "en" }),
		).not.toThrow();
		expectIssue(
			() => defineSite({ collections: { note: note({ tab: " " }) }, locales, defaultLocale: "en" }),
			"collections.note.layout[0].tab",
			"tab-name",
		);
		expectIssue(
			() => defineSite({ collections: { note: note({ view: "Search" }) }, locales, defaultLocale: "en" }),
			"collections.note.fields.preview.view",
			"view-name",
		);
	});

	it("requires a title text field in every collection", () => {
		const untitled = defineCollection({
			label: "Note",
			kind: "item",
			fields: { name: fields.text({ label: "Name" }) },
		});
		expectIssue(
			() => defineSite({ collections: { untitled }, locales, defaultLocale: "en" }),
			"collections.untitled.fields",
			"title-missing",
		);
		const wrongKind = defineCollection({
			label: "Note",
			kind: "item",
			fields: { title: fields.select({ label: "Title", options: { a: "A" }, defaultValue: "a" }) },
		});
		expectIssue(
			() => defineSite({ collections: { wrongKind }, locales, defaultLocale: "en" }),
			"collections.wrongKind.fields",
			"title-missing",
		);
	});

	describe("the title role", () => {
		const note = (noteFields: Record<string, ReturnType<typeof fields.text> | ReturnType<typeof fields.select>>) =>
			defineCollection({ label: "Note", kind: "item", fields: noteFields });
		const config = (collection: ReturnType<typeof note>) =>
			defineSite({ collections: { note: collection }, locales, defaultLocale: "en" });

		it("takes a text field of any name that has the role", () => {
			const site = config(note({ headline: fields.text({ label: "Headline", role: "title" }) }));
			expect(Object.keys(site.collections.note.fields)).toEqual(["headline"]);
		});

		it("keeps the name title for the title field once the role is elsewhere", () => {
			expect(() =>
				config(
					note({ title: fields.text({ label: "Title" }), headline: fields.text({ label: "Headline", role: "title" }) }),
				),
			).toThrow(ConfigError);
			expectIssue(
				() =>
					config(
						note({
							title: fields.text({ label: "Title" }),
							headline: fields.text({ label: "Headline", role: "title" }),
						}),
					),
				"collections.note.fields.title",
				"title-name-taken",
			);
		});

		it("rejects a title role on a field that is not text", () => {
			const select = fields.select({ label: "Kind", options: { a: "A" }, defaultValue: "a", role: "title" });
			expectIssue(
				() => config(note({ title: fields.text({ label: "Title" }), kind: select })),
				"collections.note.fields.kind.role",
				"role-kind",
			);
		});

		it("rejects two title fields", () => {
			expect(() =>
				config(
					note({
						first: fields.text({ label: "First", role: "title" }),
						second: fields.text({ label: "Second", role: "title" }),
					}),
				),
			).toThrow(ConfigError);
			expectIssue(
				() =>
					config(
						note({
							first: fields.text({ label: "First", role: "title" }),
							second: fields.text({ label: "Second", role: "title" }),
						}),
					),
				"collections.note.fields.second.role",
				"role-twice",
			);
		});

		it("rejects a title role inside a conditional field", () => {
			const nested = fields.conditional(fields.select({ label: "Kind", options: { a: "A" }, defaultValue: "a" }), {
				a: { inner: fields.text({ label: "Inner", role: "title" }) },
			});
			expectIssue(
				() =>
					defineSite({
						collections: {
							note: defineCollection({
								label: "Note",
								kind: "item",
								fields: { title: fields.text({ label: "Title" }), kind: nested },
							}),
						},
						locales,
						defaultLocale: "en",
					}),
				"collections.note.fields.kind.values.a.inner.role",
				"title-nested",
			);
		});
	});

	it("rejects a collection named like the media library", () => {
		const media = defineCollection({ label: "Media", kind: "item", fields: { title, slug } });
		const issues = issuesOf(() => defineSite({ collections: { media }, locales, defaultLocale: "en" }));
		expect(issues).toContainEqual(expect.objectContaining({ path: "collections.media" }));
		// The same collection under another name is fine.
		expect(issuesOf(() => defineSite({ collections: { gallery: media }, locales, defaultLocale: "en" }))).toEqual([]);
	});

	it("rejects a collection with more than one slug field", () => {
		const twoSlugs = defineCollection({
			label: "Page",
			kind: "document",
			fields: {
				title: fields.text({ label: "Title" }),
				slug: fields.slug({ label: "Slug", from: "title" }),
				handle: fields.slug({ label: "Handle", from: "title" }),
			},
		});
		expectIssue(
			() => defineSite({ collections: { twoSlugs }, locales, defaultLocale: "en" }),
			"collections.twoSlugs.fields",
			"many-slugs",
		);
	});

	it("checks field roles: one field per role, and the field kind fits", () => {
		const article = (extra: Parameters<typeof defineCollection>[0]["fields"]) =>
			defineCollection({ label: "Article", kind: "document", fields: { title, ...extra } });
		const ok = article({
			excerpt: fields.text({ label: "Excerpt", role: "summary", fillFromBody: true }),
			metaTitle: fields.text({ label: "Meta title", role: "seoTitle" }),
			robots: fields.select({
				label: "Robots",
				role: "noindex",
				options: { index: "Index", noindex: "No index" },
				defaultValue: "index",
			}),
		});
		expect(() => defineSite({ collections: { ok }, locales, defaultLocale: "en" })).not.toThrow();

		const twice = article({
			excerpt: fields.text({ label: "Excerpt", role: "summary" }),
			intro: fields.text({ label: "Intro", role: "summary" }),
		});
		expectIssue(
			() => defineSite({ collections: { twice }, locales, defaultLocale: "en" }),
			"collections.twice.fields.intro.role",
			"role-twice",
		);

		// The core only checks the type of the summary role (`summary`). The type of other roles (e.g. the SEO extension's `noindex`) is checked by that extension.
		const wrongSummary = article({
			excerpt: { ...fields.relation({ label: "E", to: "article" }), role: "summary" } as never,
		});
		expectIssue(
			() => defineSite({ collections: { article: wrongSummary }, locales, defaultLocale: "en" }),
			"collections.article.fields.excerpt.role",
			"role-kind",
		);
		const anyKind = article({
			hero: fields.media({ label: "Hero", role: "heroImage" }),
			robots: fields.select({ label: "Robots", role: "noindex", options: { index: "Index" }, defaultValue: "index" }),
		});
		expect(() => defineSite({ collections: { anyKind }, locales, defaultLocale: "en" })).not.toThrow();
		const badName = article({ teaser: fields.text({ label: "Teaser", role: "not a name" }) });
		expectIssue(
			() => defineSite({ collections: { badName }, locales, defaultLocale: "en" }),
			"collections.badName.fields.teaser.role",
			"role-name",
		);
	});

	it("checks media fields, and refuses a tab on a field: tabs live on layout groups", () => {
		const article = (extra: Parameters<typeof defineCollection>[0]["fields"]) =>
			defineCollection({ label: "Article", kind: "document", fields: { title, ...extra } });
		const ok = article({ hero: fields.media({ label: "Hero", accept: "file" }) });
		expect(() => defineSite({ collections: { ok }, locales, defaultLocale: "en" })).not.toThrow();
		const tabbed = article({ hero: { ...fields.media({ label: "Hero" }), tab: "Media" } as never });
		expectIssue(
			() => defineSite({ collections: { tabbed }, locales, defaultLocale: "en" }),
			"collections.tabbed.fields.hero.tab",
			"unknown-key",
		);
		const hidden = article({ note: { ...fields.text({ label: "Note" }), hidden: true } as never });
		expectIssue(
			() => defineSite({ collections: { hidden }, locales, defaultLocale: "en" }),
			"collections.hidden.fields.note.hidden",
			"unknown-key",
		);
		const badAccept = article({ hero: { ...fields.media({ label: "Hero" }), accept: "video" } as never });
		expectIssue(
			() => defineSite({ collections: { badAccept }, locales, defaultLocale: "en" }),
			"collections.badAccept.fields.hero.accept",
			"enum",
		);
	});

	it("passes the whole config and other plugins to plugin checks", () => {
		const seen: unknown[] = [];
		const other = definePlugin({ name: "other", options: {}, contributes: { ai: { actions: {} } } });
		const watcher = definePlugin({
			name: "watcher",
			options: {},
			checkConfig: (view) => {
				seen.push(
					view.defaultLocale,
					view.plugins.map((plugin) => plugin.name),
					view.blockDefinitions.length > 0,
				);
			},
		});
		const article = defineCollection({
			label: "Article",
			kind: "document",
			fields: { title },
		});
		defineSite({ collections: { article }, locales, defaultLocale: "en", plugins: [other, watcher] });
		expect(seen).toEqual(["en", ["other", "watcher"], true]);
	});

	it("allows fillFromBody only in collections with a body", () => {
		const note = defineCollection({
			label: "Note",
			kind: "item",
			fields: { title, summary: fields.text({ label: "Summary", fillFromBody: true }) },
		});
		expectIssue(
			() => defineSite({ collections: { note }, locales, defaultLocale: "en" }),
			"collections.note.fields.summary.fillFromBody",
			"fill-needs-body",
		);
	});

	describe("checks that hold for a config written in code as for the schema file", () => {
		const site = (noteFields: Record<string, never>, extra: Record<string, unknown> = {}) =>
			defineSite({
				collections: {
					note: defineCollection({ label: "Note", kind: "item", fields: { title, ...noteFields } as never, ...extra }),
				},
				locales,
				defaultLocale: "en",
			});

		it("rejects a layout group that lists a field the collection does not have", () => {
			expectIssue(
				() => site({}, { layout: [{ fields: ["title", "missing"] }] }),
				"collections.note.layout[0].fields[1]",
				"unknown-field",
			);
			expect(() => site({}, { layout: [{ fields: ["title"] }] })).not.toThrow();
		});

		it("rejects a select whose default is not one of its options", () => {
			const kind = { ...fields.select({ label: "Kind", options: { a: "A" }, defaultValue: "a" }), defaultValue: "b" };
			expectIssue(() => site({ kind } as never), "collections.note.fields.kind.defaultValue", "default-not-option");
		});

		it("rejects a conditional field that shows fields for an option its select does not have", () => {
			const kind = fields.conditional(fields.select({ label: "Kind", options: { a: "A" }, defaultValue: "a" }), {
				a: { inner: fields.text({ label: "Inner" }) },
				b: { other: fields.text({ label: "Other" }) },
			} as never);
			expectIssue(() => site({ kind } as never), "collections.note.fields.kind.values.b", "branch-not-option");
		});

		it("checks the role and required of the address field like those of any other", () => {
			const badRole = fields.slug({ label: "Slug", from: "title", role: "not a name" });
			expectIssue(() => site({ slug: badRole } as never), "collections.note.fields.slug.role", "role-name");
			const required = { ...fields.slug({ label: "Slug", from: "title" }), required: "publish" };
			expectIssue(() => site({ slug: required } as never), "collections.note.fields.slug.required", "enum");
			const summaryRole = fields.slug({ label: "Slug", from: "title", role: "summary" });
			expectIssue(() => site({ slug: summaryRole } as never), "collections.note.fields.slug.role", "role-kind");
		});
	});

	it("checks that a slug is made from a text field", () => {
		const withFrom = (from: string) =>
			defineCollection({
				label: "Topic",
				kind: "item",
				fields: { title, name: fields.text({ label: "Name" }), slug: fields.slug({ label: "Slug", from }) },
			});
		expect(() => defineSite({ collections: { topic: withFrom("name") }, locales, defaultLocale: "en" })).not.toThrow();
		expectIssue(
			() => defineSite({ collections: { topic: withFrom("missing") }, locales, defaultLocale: "en" }),
			"collections.topic.fields.slug.from",
			"slug-source",
		);
	});
});

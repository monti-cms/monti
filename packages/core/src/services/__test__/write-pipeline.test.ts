import { describe, expect, it, vi } from "vitest";
import { contentCollection, defaultLocale, requiredMetadata } from "../../../test/any-site";
import { paragraphsFormat } from "../../../test/paragraphs-format";
import { testSite } from "../../../test/site";
import { contentOf, docOf, docOf as docOfText } from "../../../test/stored-content";
import { linkAddressKey } from "../../core/link-ids";
import { linkMarkAttrs, mapLinkAttrs } from "../../doc/entry-links";
import type { StoredDocument } from "../../doc/stored-document";
import type { CmsNode } from "../../doc/types";
import { createFormatRegistry } from "../../format/registry";
import type { HookSource, WriteHookContext } from "../reactions";
import { type PreparedSnapshot, ServiceError, type ServiceInput } from "../types";
import { createWritePipeline, type WriteRequest } from "../write-pipeline";

/** The ordering, isolation and failure rules of the write pipeline, without a database. Collection names come from the config. */

const formats = async () => createFormatRegistry([paragraphsFormat]);

/** A write of a body given as text in the format of the format tests (a text with `<<<` is one it cannot read). */
const input = (metadata: Record<string, unknown> = { title: "Title" }, text = "Body"): ServiceInput =>
	({
		collection: contentCollection,
		slug: "slug",
		metadata,
		format: "paragraphs",
		body: text,
	}) as unknown as ServiceInput;

const request = (overrides: Partial<WriteRequest> = {}): WriteRequest => ({
	operation: "create",
	locale: "en",
	input: input(),
	...overrides,
});

const pipelineWith = (...sources: HookSource[]) =>
	createWritePipeline({ site: testSite, hooks: () => sources, formats });

const rejection = async (run: Promise<unknown>) => {
	try {
		await run;
	} catch (error) {
		return error as ServiceError;
	}
	throw new Error("expected the pipeline to reject");
};

describe("write pipeline", () => {
	it("WRITE-H1 runs the transform hooks in order, each on the result of the previous one", async () => {
		const seen: unknown[] = [];
		const first: HookSource = {
			owner: "server",
			hooks: {
				beforeValidate: ({ metadata, doc }) => {
					seen.push(metadata.title);
					return { metadata: { ...metadata, title: `${String(metadata.title)} A` }, doc };
				},
			},
		};
		const second: HookSource = {
			owner: "plugin:seo",
			hooks: {
				beforeValidate: ({ metadata, doc }) => {
					seen.push(metadata.title);
					return { metadata: { ...metadata, title: `${String(metadata.title)} B` }, doc };
				},
			},
		};
		const { snapshot, transformed } = await pipelineWith(first, second).run(request());
		expect(seen).toEqual(["Title", "Title A"]);
		expect(snapshot.metadata.title).toBe("Title A B");
		expect(transformed).toBe(true);
	});

	it("WRITE-H1 hands hooks the operation, collection, entry, locale and a copy of the data", async () => {
		const contexts: WriteHookContext[] = [];
		const pipeline = pipelineWith({
			owner: "server",
			hooks: {
				beforeValidate: (context) => {
					contexts.push(context);
					// Changing what a hook received, without returning it, changes nothing.
					(context.metadata as Record<string, unknown>).title = "mutated";
				},
			},
		});
		const original = input({ title: "Title" });
		const { snapshot, transformed } = await pipeline.run(
			request({ operation: "save", entryId: "entry-1", locale: defaultLocale, input: original }),
		);
		expect(contexts).toHaveLength(1);
		expect(contexts[0]).toMatchObject({
			operation: "save",
			collection: contentCollection,
			entryId: "entry-1",
			locale: defaultLocale,
			metadata: { title: "mutated" },
		});
		expect(snapshot.metadata.title).toBe("Title");
		expect(original.metadata).toEqual({ title: "Title" });
		expect(transformed).toBe(false);
	});

	it("WRITE-H1 gets the address of the entry, and may change it", async () => {
		const seen: (string | null)[] = [];
		const { snapshot } = await pipelineWith({
			owner: "server",
			hooks: {
				beforeValidate: ({ slug, metadata, doc }) => {
					seen.push(slug);
					return { metadata, doc, slug: slug?.toUpperCase() };
				},
				beforeSave: ({ slug }) => {
					seen.push(slug);
				},
			},
		}).run(request({ input: { ...input(), slug: "mixed-case" } as ServiceInput }));
		// The transform saw what was sent, the validation what core prepared from what the transform returned.
		expect(seen).toEqual(["mixed-case", "MIXED-CASE"]);
		expect(snapshot.slug).toBe("MIXED-CASE");
	});

	it("WRITE-H1 keeps the body as it came in when a transform leaves it alone", async () => {
		const text = "Body";
		const plain = await createWritePipeline({ site: testSite, formats }).run(
			request({ input: input({ title: "Title" }, text) }),
		);
		const withHook = await pipelineWith({
			owner: "server",
			hooks: { beforeValidate: ({ metadata, doc }) => ({ metadata: { ...metadata, title: "Changed" }, doc }) },
		}).run(request({ input: input({ title: "Title" }, text) }));
		// Each preparation draws its own block ids; what the body says is the same.
		expect(contentOf(withHook.snapshot.doc)).toEqual(contentOf(plain.snapshot.doc));
		expect(withHook.snapshot.metadata.title).toBe("Changed");
	});

	it("WRITE-H1 prepares a body a transform replaced, as a document", async () => {
		const replacement = docOf("Replaced\n");
		const { snapshot } = await pipelineWith({
			owner: "server",
			hooks: { beforeValidate: ({ metadata }) => ({ metadata, doc: replacement }) },
		}).run(request());
		expect(contentOf(snapshot.doc)).toEqual(contentOf(replacement));
	});

	it("WRITE-H1 rejects what core preparation rejects, whatever a transform returns", async () => {
		const hook = vi.fn(({ metadata, doc }: WriteHookContext) => ({ metadata: { ...metadata, notAField: "x" }, doc }));
		const error = await rejection(pipelineWith({ owner: "server", hooks: { beforeValidate: hook } }).run(request()));
		expect(error).toBeInstanceOf(ServiceError);
		expect(error.code).toBe("invalid_metadata_key");
	});

	it("WRITE-H1 does not call hooks for input that core preparation rejects, and rejects it as without hooks", async () => {
		const transform = vi.fn();
		const validate = vi.fn();
		const pipeline = pipelineWith({ owner: "server", hooks: { beforeValidate: transform, beforeSave: validate } });
		const bad = {
			collection: contentCollection,
			slug: "slug",
			metadata: "not metadata",
			format: "paragraphs",
			body: "",
		} as unknown as ServiceInput;
		const error = await rejection(pipeline.run(request({ input: bad })));
		expect(error.code).toBe("invalid_input");
		expect(transform).not.toHaveBeenCalled();
		expect(validate).not.toHaveBeenCalled();
	});

	it("WRITE-H1 collects the failures of every validate hook and blocks with all of them", async () => {
		const pipeline = pipelineWith(
			{ owner: "server", hooks: { beforeSave: () => ({ issues: [{ code: "first" }] }) } },
			{
				owner: "plugin:seo",
				hooks: { beforeSave: () => ({ issues: [{ code: "second" }], warnings: [{ code: "w" }] }) },
			},
		);
		const error = await rejection(pipeline.run(request()));
		expect(error.code).toBe("validation_failed");
		expect(error.issues?.map((issue) => issue.code)).toEqual(["first", "second"]);
	});

	it("WRITE-P8 saves a text body the format cannot read as an unparsed body, and warns with the field and where the text breaks", async () => {
		const { snapshot, warnings } = await pipelineWith().run(
			request({ input: input({ title: "Title" }, "<<<Unclosed") }),
		);
		expect(snapshot.doc.content).toEqual([
			expect.objectContaining({ type: "unparsed", attrs: { format: "paragraphs", source: "<<<Unclosed" } }),
		]);
		expect(warnings).toEqual([{ code: "bad_marker", path: "body", position: { line: 1, column: 1 } }]);
	});

	it("WRITE-P8 warns the same when hooks are registered, and a text body that reads gives no warning", async () => {
		const pipeline = pipelineWith({ owner: "server", hooks: { beforeSave: () => undefined } });
		const bad = await pipeline.run(request({ input: input({ title: "Title" }, "<<<Unclosed") }));
		expect(bad.warnings.map((warning) => warning.code)).toEqual(["bad_marker"]);
		const good = await pipeline.run(request({ input: input({ title: "Title" }, "Fine") }));
		expect(good.warnings).toEqual([]);
		expect((await pipelineWith().run(request())).warnings).toEqual([]);
	});

	it("WRITE-H1 passes warnings through without blocking", async () => {
		const pipeline = pipelineWith(
			{ owner: "server", hooks: { beforeSave: () => ({ warnings: [{ code: "check-this" }] }) } },
			{ owner: "plugin:seo", hooks: { beforeSave: () => undefined } },
		);
		const { warnings } = await pipeline.run(request());
		expect(warnings).toEqual([{ code: "check-this" }]);
	});

	it("WRITE-H1 gives validation a copy of the snapshot: changing it cannot remove a core issue or change what is stored", async () => {
		let seen: PreparedSnapshot | undefined;
		const pipeline = pipelineWith({
			owner: "server",
			hooks: {
				beforeSave: ({ snapshot }) => {
					seen = snapshot;
					(snapshot.issues as unknown as unknown[]).length = 0;
					(snapshot.metadata as Record<string, unknown>).title = "tampered";
				},
			},
		});
		// A body that does not parse is a core issue of a publish. The hook emptied its copy of the issues; the result still has them.
		const { snapshot } = await pipeline.run(
			request({ operation: "publish", input: input({ title: "Title" }, "<<<Unclosed") }),
		);
		expect(seen?.issues).toEqual([]);
		expect(snapshot.issues.map((issue) => issue.code)).toContain("unparsed_body");
		expect(snapshot.metadata.title).toBe("Title");
	});

	it("WRITE-H1 runs validatePublish for a publish only", async () => {
		const validatePublish = vi.fn(() => undefined);
		const pipeline = pipelineWith({ owner: "server", hooks: { beforePublish: validatePublish } });
		await pipeline.run(request({ operation: "create" }));
		await pipeline.run(request({ operation: "save", entryId: "e" }));
		expect(validatePublish).not.toHaveBeenCalled();
		await pipeline.run(request({ operation: "publish", entryId: "e" }));
		expect(validatePublish).toHaveBeenCalledTimes(1);
	});

	it("WRITE-H1 blocks a publish with the issues validatePublish adds, next to the core issues of the draft", async () => {
		const pipeline = pipelineWith({
			owner: "server",
			hooks: { beforePublish: () => ({ issues: [{ code: "not-yet" }] }) },
		});
		const error = await rejection(
			pipeline.run(request({ operation: "publish", entryId: "e", input: input({ title: "T" }, "") })),
		);
		expect(error.code).toBe("publish_validation_failed");
		expect(error.issues?.map((issue) => issue.code)).toContain("not-yet");
	});

	it("WRITE-H2 fails with hook_failed naming the hook and its owner, and does not repeat the hook's message", async () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		const pipeline = pipelineWith(
			{ owner: "server", hooks: { beforeValidate: () => undefined } },
			{
				owner: "plugin:seo",
				hooks: {
					beforeSave: async () => {
						throw new Error("secret detail");
					},
				},
			},
		);
		const error = await rejection(pipeline.run(request()));
		expect(error.code).toBe("hook_failed");
		expect(error.issues).toEqual([
			expect.objectContaining({ code: "hook_failed", params: { hook: "beforeSave", owner: "plugin:seo" } }),
		]);
		expect(JSON.stringify(error.issues)).not.toContain("secret detail");
	});

	it.each([
		["a transform that returns something that is not data", { beforeValidate: () => 5 as never }],
		[
			"a transform that returns metadata that is not an object",
			{ beforeValidate: () => ({ metadata: 5, doc: null }) as never },
		],
		[
			"a transform that returns a document that is not one",
			{ beforeValidate: ({ metadata }: WriteHookContext) => ({ metadata, doc: { nope: true } }) as never },
		],
		[
			"a validate hook that returns issues without a code",
			{ beforeSave: () => ({ issues: [{ message: "x" }] }) as never },
		],
		["a validate hook that returns something that is not a result", { beforeSave: () => 5 as never }],
	])("WRITE-H2 fails with hook_failed for %s", async (_name, hooks) => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		const error = await rejection(pipelineWith({ owner: "server", hooks }).run(request()));
		expect(error.code).toBe("hook_failed");
	});

	it("WRITE-H1 skips transform hooks when asked, still prepares, and still validates", async () => {
		const transform = vi.fn();
		const validatePublish = vi.fn(() => ({ warnings: [{ code: "checked" }] }));
		const { snapshot, warnings, transformed } = await pipelineWith({
			owner: "server",
			hooks: { beforeValidate: transform, beforePublish: validatePublish },
		}).run(request({ operation: "restore", skipTransform: true }));
		expect(transform).not.toHaveBeenCalled();
		expect(validatePublish).toHaveBeenCalledTimes(1);
		expect(snapshot.collection).toBe(contentCollection);
		expect(warnings).toEqual([{ code: "checked" }]);
		expect(transformed).toBe(false);
	});

	it("WRITE-H3 reads the hooks on every write, so a plugin that loads late is used", async () => {
		let sources: HookSource[] = [];
		const pipeline = createWritePipeline({ site: testSite, hooks: () => sources, formats });
		await expect(pipeline.run(request())).resolves.toMatchObject({
			snapshot: { collection: contentCollection },
			transformed: false,
		});
		sources = [{ owner: "server", hooks: { beforeSave: () => ({ issues: [{ code: "late" }] }) } }];
		await expect(pipeline.run(request())).rejects.toMatchObject({ code: "validation_failed" });
	});
});

describe("turning links by address into links by id", () => {
	const ID = "123e4567-e89b-42d3-a456-426614174000";
	const pathOf = (slug: string) => testSite.contentPath(contentCollection, slug) as string;

	/** The text read by the test reader, with a link to `entry:<id>` made an entry link, as a format that knows the notation writes it. */
	const docOf = (text: string): StoredDocument => {
		const doc = docOfText(text);
		const content = mapLinkAttrs(doc.content, (attrs) =>
			typeof attrs.href === "string"
				? linkMarkAttrs(attrs.href, typeof attrs.title === "string" ? attrs.title : null)
				: undefined,
		);
		return { ...doc, content: content as CmsNode[] };
	};

	const formats = async () => createFormatRegistry([paragraphsFormat]);

	/** A write of a body given as a document (the text read by the test reader). */
	const input = async (text: string): Promise<ServiceInput> =>
		({
			collection: contentCollection,
			slug: "entry",
			metadata: await requiredMetadata(contentCollection, "Post", async () => "00000000-0000-4000-8000-000000000009"),
			doc: docOf(text),
		}) as ServiceInput;

	/** A write of the same body given as text in a format. */
	const textInput = async (text: string): Promise<ServiceInput> => {
		const { doc: _doc, ...rest } = (await input("")) as ServiceInput & { doc?: unknown };
		return { ...rest, format: "paragraphs", body: text } as ServiceInput;
	};

	it("SITE-R3 the write pipeline does it for text and for a document, and keeps the input as it came when there is nothing to do", async () => {
		const seen: string[] = [];
		const pipeline = createWritePipeline({
			site: testSite,
			formats,
			links: async (addresses) => {
				seen.push(...addresses.map((address) => linkAddressKey(testSite, address)));
				return new Map(addresses.map((address) => [linkAddressKey(testSite, address), ID]));
			},
		});
		const run = (given: ServiceInput) => pipeline.run({ operation: "create", locale: defaultLocale, input: given });

		const fromText = await run(await textInput(`[a](${pathOf("a")})`));
		const fromDoc = await run(await input(`[a](${pathOf("a")})`));
		const plain = await run(await input("No links."));

		for (const result of [fromText, fromDoc]) {
			expect(JSON.stringify(result.snapshot.doc)).toContain(`"entryId":"${ID}"`);
			expect(result.snapshot.references.some((ref) => ref.kind === "entry" && ref.targetId === ID)).toBe(true);
		}
		expect(JSON.stringify(plain.snapshot.doc)).not.toContain("entryId");
		expect(seen).toEqual([
			linkAddressKey(testSite, { collection: contentCollection, slug: "a" }),
			linkAddressKey(testSite, { collection: contentCollection, slug: "a" }),
		]);
	});

	it("SITE-R3 without a resolver, links keep their address", async () => {
		const result = await createWritePipeline({ site: testSite, formats }).run({
			operation: "create",
			locale: defaultLocale,
			input: await input(`[a](${pathOf("a")})`),
		});

		expect(JSON.stringify(result.snapshot.doc)).toContain(pathOf("a"));
		expect(result.snapshot.internalLinks).toHaveLength(1);
	});
});

import { describe, expect, it, vi } from "vitest";
import { contentCollection } from "../../../test/any-site";
import { bodyFromMdx } from "../../mdx/stored-document";
import type { HookSource, WriteHookContext } from "../hooks";
import { type PreparedSnapshot, ServiceError, type ServiceInput } from "../types";
import { createWritePipeline, type WriteRequest } from "../write-pipeline";

/** The ordering, isolation and failure rules of the write pipeline, without a database. Collection names come from the config. */

const input = (metadata: Record<string, unknown> = { title: "Title" }, mdx = "Body\n"): ServiceInput =>
	({ collection: contentCollection, slug: "slug", metadata, mdx }) as unknown as ServiceInput;

const request = (overrides: Partial<WriteRequest> = {}): WriteRequest => ({
	operation: "create",
	locale: "en",
	input: input(),
	...overrides,
});

const pipelineWith = (...sources: HookSource[]) => createWritePipeline({ hooks: () => sources });

const rejection = async (run: Promise<unknown>) => {
	try {
		await run;
	} catch (error) {
		return error as ServiceError;
	}
	throw new Error("expected the pipeline to reject");
};

describe("write pipeline", () => {
	it("runs the transform hooks in order, each on the result of the previous one", async () => {
		const seen: unknown[] = [];
		const first: HookSource = {
			owner: "server",
			hooks: {
				transform: ({ metadata, doc }) => {
					seen.push(metadata.title);
					return { metadata: { ...metadata, title: `${String(metadata.title)} A` }, doc };
				},
			},
		};
		const second: HookSource = {
			owner: "plugin:seo",
			hooks: {
				transform: ({ metadata, doc }) => {
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

	it("hands hooks the operation, collection, entry, locale and a copy of the data", async () => {
		const contexts: WriteHookContext[] = [];
		const pipeline = pipelineWith({
			owner: "server",
			hooks: {
				transform: (context) => {
					contexts.push(context);
					// Changing what a hook received, without returning it, changes nothing.
					(context.metadata as Record<string, unknown>).title = "mutated";
				},
			},
		});
		const original = input({ title: "Title" });
		const { snapshot, transformed } = await pipeline.run(
			request({ operation: "save", entryId: "entry-1", locale: "ko", input: original }),
		);
		expect(contexts).toHaveLength(1);
		expect(contexts[0]).toMatchObject({
			operation: "save",
			collection: contentCollection,
			entryId: "entry-1",
			locale: "ko",
			metadata: { title: "mutated" },
		});
		expect(snapshot.metadata.title).toBe("Title");
		expect(original.metadata).toEqual({ title: "Title" });
		expect(transformed).toBe(false);
	});

	it("keeps the body as it came in when a transform leaves it alone", async () => {
		const mdx = "Body\n";
		const plain = await createWritePipeline().run(request({ input: input({ title: "Title" }, mdx) }));
		const withHook = await pipelineWith({
			owner: "server",
			hooks: { transform: ({ metadata, doc }) => ({ metadata: { ...metadata, title: "Changed" }, doc }) },
		}).run(request({ input: input({ title: "Title" }, mdx) }));
		expect(withHook.snapshot.mdx).toBe(plain.snapshot.mdx);
		expect(withHook.snapshot.metadata.title).toBe("Changed");
	});

	it("prepares a body a transform replaced, as a document", async () => {
		const replacement = bodyFromMdx("Replaced\n").doc;
		expect(replacement).not.toBeNull();
		const { snapshot } = await pipelineWith({
			owner: "server",
			hooks: { transform: ({ metadata }) => ({ metadata, doc: replacement }) },
		}).run(request());
		expect(snapshot.mdx).toContain("Replaced");
		expect(snapshot.doc).not.toBeNull();
	});

	it("rejects what core preparation rejects, whatever a transform returns", async () => {
		const hook = vi.fn(({ metadata, doc }: WriteHookContext) => ({ metadata: { ...metadata, notAField: "x" }, doc }));
		const error = await rejection(pipelineWith({ owner: "server", hooks: { transform: hook } }).run(request()));
		expect(error).toBeInstanceOf(ServiceError);
		expect(error.code).toBe("invalid_metadata_key");
	});

	it("does not call hooks for input that core preparation rejects, and rejects it as without hooks", async () => {
		const transform = vi.fn();
		const validate = vi.fn();
		const pipeline = pipelineWith({ owner: "server", hooks: { transform, validate } });
		const bad = {
			collection: contentCollection,
			slug: "slug",
			metadata: "not metadata",
			mdx: "",
		} as unknown as ServiceInput;
		const error = await rejection(pipeline.run(request({ input: bad })));
		expect(error.code).toBe("invalid_input");
		expect(transform).not.toHaveBeenCalled();
		expect(validate).not.toHaveBeenCalled();
	});

	it("collects the failures of every validate hook and blocks with all of them", async () => {
		const pipeline = pipelineWith(
			{ owner: "server", hooks: { validate: () => ({ issues: [{ code: "first" }] }) } },
			{ owner: "plugin:seo", hooks: { validate: () => ({ issues: [{ code: "second" }], warnings: [{ code: "w" }] }) } },
		);
		const error = await rejection(pipeline.run(request()));
		expect(error.code).toBe("validation_failed");
		expect(error.issues?.map((issue) => issue.code)).toEqual(["first", "second"]);
	});

	it("passes warnings through without blocking", async () => {
		const pipeline = pipelineWith(
			{ owner: "server", hooks: { validate: () => ({ warnings: [{ code: "check-this" }] }) } },
			{ owner: "plugin:seo", hooks: { validate: () => undefined } },
		);
		const { warnings } = await pipeline.run(request());
		expect(warnings).toEqual([{ code: "check-this" }]);
	});

	it("gives validation a copy of the snapshot: changing it cannot remove a core issue or change what is stored", async () => {
		let seen: PreparedSnapshot | undefined;
		const pipeline = pipelineWith({
			owner: "server",
			hooks: {
				validate: ({ snapshot }) => {
					seen = snapshot;
					(snapshot.issues as unknown as unknown[]).length = 0;
					(snapshot.metadata as Record<string, unknown>).title = "tampered";
				},
			},
		});
		// A body that does not parse is a core issue of a publish. The hook emptied its copy of the issues; the result still has them.
		const { snapshot } = await pipeline.run(
			request({ operation: "publish", input: input({ title: "Title" }, "<Unclosed") }),
		);
		expect(seen?.issues).toEqual([]);
		expect(snapshot.issues.map((issue) => issue.code)).toContain("mdx_error");
		expect(snapshot.metadata.title).toBe("Title");
	});

	it("runs validatePublish for a publish only", async () => {
		const validatePublish = vi.fn(() => undefined);
		const pipeline = pipelineWith({ owner: "server", hooks: { validatePublish } });
		await pipeline.run(request({ operation: "create" }));
		await pipeline.run(request({ operation: "save", entryId: "e" }));
		expect(validatePublish).not.toHaveBeenCalled();
		await pipeline.run(request({ operation: "publish", entryId: "e" }));
		expect(validatePublish).toHaveBeenCalledTimes(1);
	});

	it("blocks a publish with the issues validatePublish adds, next to the core issues of the draft", async () => {
		const pipeline = pipelineWith({
			owner: "server",
			hooks: { validatePublish: () => ({ issues: [{ code: "not-yet" }] }) },
		});
		const error = await rejection(
			pipeline.run(request({ operation: "publish", entryId: "e", input: input({ title: "T" }, "") })),
		);
		expect(error.code).toBe("publish_validation_failed");
		expect(error.issues?.map((issue) => issue.code)).toContain("not-yet");
	});

	it("fails with hook_failed naming the hook and its owner, and does not repeat the hook's message", async () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		const pipeline = pipelineWith(
			{ owner: "server", hooks: { transform: () => undefined } },
			{
				owner: "plugin:seo",
				hooks: {
					validate: async () => {
						throw new Error("secret detail");
					},
				},
			},
		);
		const error = await rejection(pipeline.run(request()));
		expect(error.code).toBe("hook_failed");
		expect(error.issues).toEqual([
			expect.objectContaining({ code: "hook_failed", params: { hook: "validate", owner: "plugin:seo" } }),
		]);
		expect(JSON.stringify(error.issues)).not.toContain("secret detail");
	});

	it.each([
		["a transform that returns something that is not data", { transform: () => 5 as never }],
		[
			"a transform that returns metadata that is not an object",
			{ transform: () => ({ metadata: 5, doc: null }) as never },
		],
		[
			"a transform that returns a document that is not one",
			{ transform: ({ metadata }: WriteHookContext) => ({ metadata, doc: { nope: true } }) as never },
		],
		[
			"a validate hook that returns issues without a code",
			{ validate: () => ({ issues: [{ message: "x" }] }) as never },
		],
		["a validate hook that returns something that is not a result", { validate: () => 5 as never }],
	])("fails with hook_failed for %s", async (_name, hooks) => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		const error = await rejection(pipelineWith({ owner: "server", hooks }).run(request()));
		expect(error.code).toBe("hook_failed");
	});

	it("skips hooks when asked, and still prepares", async () => {
		const transform = vi.fn();
		const { snapshot, warnings } = await pipelineWith({ owner: "server", hooks: { transform } }).run(
			request({ skipHooks: true }),
		);
		expect(transform).not.toHaveBeenCalled();
		expect(snapshot.collection).toBe(contentCollection);
		expect(warnings).toEqual([]);
	});

	it("reads the hooks on every write, so a plugin that loads late is used", async () => {
		let sources: HookSource[] = [];
		const pipeline = createWritePipeline({ hooks: () => sources });
		await expect(pipeline.run(request())).resolves.toBeDefined();
		sources = [{ owner: "server", hooks: { validate: () => ({ issues: [{ code: "late" }] }) } }];
		await expect(pipeline.run(request())).rejects.toMatchObject({ code: "validation_failed" });
	});
});

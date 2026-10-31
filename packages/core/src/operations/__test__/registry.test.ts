import { describe, expect, it } from "vitest";
import { z } from "zod";
import { testConfig, testSite } from "../../../test/site";
import type { AuthContext } from "../../adapters/auth";
import { fakeCms } from "../../cms";
import { currentActor } from "../../core/actor";
import { CORE_OPERATIONS, defineOperation, type OperationContext } from "..";
import { OPERATION_NAME } from "../define";
import { inputJsonSchema } from "../registry";

const admin: AuthContext = { userId: "u", accountId: "123", isAdmin: true, name: "Mina Park" };

const whoAmIDefinition = {
	name: "test.whoAmI",
	kind: "read" as const,
	describe: "Reports who runs it and the input it parsed.",
	input: () => z.object({ count: z.coerce.number().int().default(2), label: z.string().optional() }),
	run: (input: { count: number; label?: string | undefined }, { auth }: OperationContext) => ({
		actor: currentActor(),
		account: auth.accountId,
		input,
	}),
};
const whoAmI = defineOperation(whoAmIDefinition);

const withOperations = (...plugins: { name: string; operations: ReturnType<typeof defineOperation>[] }[]) =>
	fakeCms({ config: testConfig, plugins });

describe("defineOperation", () => {
	it("API-O1 rejects a name that is not dotted or does not start lowercase", () => {
		for (const name of ["list", "Entries.list", "entries.", "entries.list-all", "entries..list", "entries.1st"]) {
			expect(() => defineOperation({ ...whoAmIDefinition, name })).toThrow(/invalid name/);
		}
	});

	it("API-O1 rejects an empty description", () => {
		expect(() => defineOperation({ ...whoAmIDefinition, describe: "  " })).toThrow(/describe/);
	});
});

describe("the operations of an instance", () => {
	it("API-O1 hold every core operation, each with a model description and an input that converts to JSON Schema", async () => {
		const operations = await withOperations().operations();
		for (const core of CORE_OPERATIONS) {
			const found = operations.find((operation) => operation.name === core.name);
			expect(found, core.name).toMatchObject({ plugin: null });
			expect(found?.describe.length).toBeGreaterThan(20);
		}
		expect(new Set(operations.map((operation) => operation.name)).size).toBe(operations.length);
		for (const operation of operations) {
			expect(OPERATION_NAME.test(operation.name)).toBe(true);
			// The model is given this: it must convert, and describe an object.
			expect(() => z.toJSONSchema(operation.input, { io: "input" }), operation.name).not.toThrow();
			expect(operation.jsonSchema, operation.name).toMatchObject({ type: "object" });
			expect(inputJsonSchema(operation.input)).toEqual(operation.jsonSchema);
		}
	});

	it("API-O1 make the input schema for the site: entries.list names this site's collections", async () => {
		const list = (await withOperations().operations()).find((operation) => operation.name === "entries.list");
		const collection = (list?.jsonSchema as { properties: { collection: { enum: string[] } } }).properties.collection;
		expect(collection.enum).toEqual([...testSite.COLLECTIONS]);
	});

	it("API-O1 add the operations of plugins, tagged with the plugin", async () => {
		const operations = await withOperations({ name: "demo", operations: [whoAmI] }).operations();
		expect(operations.find((operation) => operation.name === "test.whoAmI")).toMatchObject({
			plugin: "demo",
			kind: "read",
		});
	});

	it("API-O1 fail when a plugin reuses the name of a core operation", async () => {
		const clash = defineOperation({ ...whoAmIDefinition, name: CORE_OPERATIONS[0]?.name ?? "" });
		await expect(withOperations({ name: "demo", operations: [clash] }).operations()).rejects.toThrow(
			/collides with the core operation/,
		);
	});

	it("API-O1 fail when two plugins use one name, and name both plugins", async () => {
		const cms = withOperations({ name: "one", operations: [whoAmI] }, { name: "two", operations: [whoAmI] });
		await expect(cms.operations()).rejects.toThrow(/plugin "one"/);
	});
});

describe("running an operation", () => {
	const cms = () => withOperations({ name: "demo", operations: [whoAmI] });

	it("API-O2 passes the input as the schema parsed it", async () => {
		const result = (await cms().runOperation("test.whoAmI", { count: "5", label: "x" }, { auth: admin })) as {
			input: unknown;
		};
		expect(result.input).toEqual({ count: 5, label: "x" });
		const defaulted = (await cms().runOperation("test.whoAmI", {}, { auth: admin })) as { input: unknown };
		expect(defaulted.input).toEqual({ count: 2 });
	});

	it("API-O2 refuses an input that does not fit, with the issues, and does not run", async () => {
		await expect(cms().runOperation("test.whoAmI", { count: "many" }, { auth: admin })).rejects.toMatchObject({
			code: "invalid_input",
			message: "Invalid input",
			issues: [expect.objectContaining({ path: ["count"] })],
		});
		await expect(
			cms().runOperation("test.whoAmI", { count: "many" }, { auth: admin, invalidMessage: "Invalid query parameters" }),
		).rejects.toMatchObject({ message: "Invalid query parameters" });
	});

	it("API-O2 says not_found for a name it does not have", async () => {
		await expect(cms().runOperation("nothing.here", {}, { auth: admin })).rejects.toMatchObject({ code: "not_found" });
	});

	it("API-O2 gives the operation the instance and a signal", async () => {
		const seen = defineOperation({
			name: "test.context",
			kind: "read",
			describe: "Returns what the context holds.",
			input: () => z.object({}),
			run: (_input, { cms: given, signal }) => ({ sameCms: given === instance, aborted: signal?.aborted }),
		});
		const instance = withOperations({ name: "demo", operations: [seen] });
		const controller = new AbortController();
		expect(await instance.runOperation("test.context", {}, { auth: admin, signal: controller.signal })).toEqual({
			sameCms: true,
			aborted: false,
		});
	});
});

import { describe, expect, it } from "vitest";
import { coreDecisions } from "../decisions";

const hotReload = (env: Record<string, string>, schemaFile: string | undefined, reloadable: boolean) =>
	coreDecisions({
		env,
		trust: { trusted: false, source: "default" },
		siteUrl: undefined,
		siteUrlSource: undefined,
		schemaFile,
		schemaFileGiven: false,
		reloadable,
	}).find((decision) => decision.topic === "Schema hot reload");

describe("the core decisions", () => {
	it("DOC-R5 turns hot reload on only in development with a schema file, and says why it is off", () => {
		const development = hotReload({ NODE_ENV: "development" }, "monti.schema.ts", true);
		expect(development?.value).toBe("on");
		expect(development?.source).toContain('NODE_ENV is "development"');

		const production = hotReload({ NODE_ENV: "production" }, "monti.schema.ts", true);
		expect(production?.value).toBe("off");
		expect(production?.source).toContain('NODE_ENV is "production"');

		const bare = hotReload({ NODE_ENV: "development" }, undefined, false);
		expect(bare).toMatchObject({ value: "off", source: "no schema file to reload" });
	});
});

import { describe, expect, it, vi } from "vitest";
import { testSite } from "../../test/site";
import { fakeCms } from "../cms";
import { problemError, problemText, SetupError } from "../core/problem";
import { importText } from "../format/convert";
import { createFormatRegistry } from "../format/registry";
import { handleApiError } from "../http/v1/error-handler";
import { parseSchemaFile } from "../schema-file/format";
import { defineConfig } from "../server";

/**
 * The errors a newcomer meets first say what is wrong, where it is and how to fix it. The tests look for the parts (the setting, the place, the command), not for the
 * whole text, so the wording can be improved without a test change.
 */

const messageOf = (fn: () => unknown): string => {
	try {
		fn();
	} catch (error) {
		return (error as Error).message;
	}
	return "";
};

describe("problemText", () => {
	it("writes what, where and fix as one line with markers", () => {
		expect(
			problemText({ what: "DATABASE_URL is not set", where: ".env.local", fix: "put your Postgres URL in it" }),
		).toBe("DATABASE_URL is not set. Where: .env.local. Fix: put your Postgres URL in it.");
	});

	it("leaves out Where when there is none, and does not double a full stop", () => {
		expect(problemText({ what: "Broken.", fix: "mend it (see above)" })).toBe("Broken. Fix: mend it (see above).");
	});

	it("is an error that keeps the cause, and the driver's code", () => {
		const cause = Object.assign(new Error("relation does not exist"), { code: "42P01" });
		const error = problemError({ what: "x", fix: "y" }, cause, "migrations_pending");
		expect(error).toBeInstanceOf(SetupError);
		expect(error.cause).toBe(cause);
		expect(error.kind).toBe("migrations_pending");
		expect(error.code).toBe("42P01");
		expect(problemError({ what: "x", fix: "y" }).code).toBe("setup_required");
	});
});

describe("a setup mistake over HTTP", () => {
	it("is a 503 that points at the server log, where the full message with the fix is printed", async () => {
		const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const response = handleApiError(
			problemError(
				{ what: "The Monti tables are missing", where: "DATABASE_SCHEMA", fix: "run `monti migrate`" },
				undefined,
				"migrations_pending",
			),
		);
		expect(response.status).toBe(503);
		expect(await response.json()).toMatchObject({
			code: "migrations_pending",
			message: expect.stringContaining("server log"),
		});
		expect(log.mock.calls.flat().join(" ")).toContain("run `monti migrate`");
		log.mockRestore();
	});
});

describe("errors of core", () => {
	it("MONTI_SECRET missing when a plugin wants to encrypt", () => {
		const secrets = fakeCms().secrets("demo");
		const message = messageOf(() => secrets.encrypt("value"));
		expect(message).toContain("MONTI_SECRET");
		expect(message).toMatch(/Where: .*\.env\.local/);
		expect(message).toContain("openssl rand -base64 32");
	});

	it("a format no plugin provides names the plugin to add and the formats the site has", async () => {
		const empty = await importText(testSite, createFormatRegistry([]), "mdx", "text", { locale: "en" }).catch(
			(error: Error) => error,
		);
		expect(empty).toMatchObject({ name: "ServiceError", code: "unknown_format" });
		const message = (empty as Error).message;
		expect(message).toContain('"mdx"');
		expect(message).toContain("Where: `plugins` in monti.config.ts");
		expect(message).toContain("mdx() from @monti-cms/mdx");
		const other = await importText(testSite, createFormatRegistry([]), "yaml", "text", { locale: "en" }).catch(
			(error: Error) => error,
		);
		expect((other as Error).message).toContain("add the plugin that provides it");
	});

	it("media storage not configured names the option and an example", () => {
		const cms = fakeCms();
		const message = messageOf(() => cms.mediaStore());
		expect(message).toContain("Media storage is not configured");
		expect(message).toContain("`storage` in monti.config.ts");
		expect(message).toContain("storage: s3Storage()");
	});

	it("defineConfig without a database or login says what to add", () => {
		const noDatabase = messageOf(() => defineConfig({ auth: {} } as never));
		expect(noDatabase).toContain("`database`");
		expect(noDatabase).toContain("database: postgres()");
		expect(noDatabase).toContain("DATABASE_URL");
		const noAuth = messageOf(() => defineConfig({ database: {} } as never));
		expect(noAuth).toContain("`auth`");
		expect(noAuth).toContain("auth({ providers: [github()] })");
	});

	it("a schema file with a wrong value lists the JSON paths and ends with how to fix them", () => {
		const message = messageOf(() => parseSchemaFile({ collections: { post: { kind: "nope" } } }, "monti.schema.json"));
		expect(message).toContain("monti.schema.json is not a valid schema file");
		expect(message).toContain("collections.post");
		expect(message).toContain("Fix: correct the lines above in monti.schema.json");
		expect(message).toContain("$schema");
	});
});

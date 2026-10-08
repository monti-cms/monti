import { describe, expect, it } from "vitest";
import { postgres } from "../adapter";

const decide = (options: Parameters<typeof postgres>[0], env: Record<string, string | undefined>) =>
	Object.fromEntries((postgres(options).decisions?.(env) ?? []).map((item) => [item.topic, item]));

describe("postgres decisions", () => {
	it("reports a URL given in the config", () => {
		const { Database } = decide(
			{ connectionString: "postgres://u:pw@db.test:5433/shop" },
			{ DATABASE_URL: "postgres://other/x" },
		);
		expect(Database?.value).toBe("db.test:5433/shop");
		expect(Database?.source).toContain("set in monti.config.ts");
	});

	it("reports a URL from the environment", () => {
		const { Database } = decide({}, { DATABASE_URL: "postgres://u:pw@localhost:5432/monti" });
		expect(Database?.value).toBe("localhost:5432/monti");
		expect(Database?.source).toBe("from env DATABASE_URL");
	});

	it("says when there is no URL", () => {
		const { Database } = decide({}, {});
		expect(Database?.value).toBe("no URL");
		expect(Database?.source).toBe("DATABASE_URL is not set");
		expect(decide({}, { DATABASE_URL: "  " }).Database?.source).toBe("DATABASE_URL is not set");
	});

	it("reports the schema from the option, the environment or the default", () => {
		expect(decide({ schema: "cms" }, { DATABASE_SCHEMA: "env" })["Database schema"]).toMatchObject({
			value: "cms",
			source: expect.stringContaining("set in monti.config.ts"),
		});
		expect(decide({}, { DATABASE_SCHEMA: "env" })["Database schema"]).toEqual({
			topic: "Database schema",
			value: "env",
			source: "from env DATABASE_SCHEMA",
		});
		expect(decide({}, {})["Database schema"]).toMatchObject({
			value: "public",
			source: expect.stringContaining("default"),
		});
	});

	it("never prints the password", () => {
		const text = JSON.stringify([
			...(postgres({ connectionString: "postgres://user:s3cr3t-pw@db.test/shop" }).decisions?.({}) ?? []),
			...(postgres().decisions?.({ DATABASE_URL: "postgres://user:s3cr3t-pw@db.test/shop" }) ?? []),
		]);
		expect(text).not.toContain("s3cr3t-pw");
		expect(text).not.toContain("user:");
	});
});

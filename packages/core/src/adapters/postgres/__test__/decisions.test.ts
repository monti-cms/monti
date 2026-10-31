import { describe, expect, it } from "vitest";
import { postgres } from "../adapter";

const decide = (options: Parameters<typeof postgres>[0], env: Record<string, string | undefined>) =>
	Object.fromEntries((postgres(options).inspector?.decisions(env) ?? []).map((item) => [item.topic, item]));

describe("postgres decisions", () => {

	it("DOC-R5 reports a URL from the environment", () => {
		const { Database } = decide({}, { DATABASE_URL: "postgres://u:pw@localhost:5432/monti" });
		expect(Database?.value).toBe("localhost:5432/monti");
		expect(Database?.source).toBe("from env DATABASE_URL");
	});

	it("CLI-P1 never prints the password", () => {
		const text = JSON.stringify([
			...(postgres({ connectionString: "postgres://user:s3cr3t-pw@db.test/shop" }).inspector?.decisions({}) ?? []),
			...(postgres().inspector?.decisions({ DATABASE_URL: "postgres://user:s3cr3t-pw@db.test/shop" }) ?? []),
		]);
		expect(text).not.toContain("s3cr3t-pw");
		expect(text).not.toContain("user:");
	});
});

import { Client } from "pg";
import { describe, expect, it } from "vitest";
import { normalizeConnectionString } from "../connection";

/** What the driver makes of a URL: the `ssl` setting it would connect with (nothing is connected). */
const sslOf = (url: string) =>
	(new Client({ connectionString: url }) as unknown as { connectionParameters: { ssl: unknown } }).connectionParameters
		.ssl;

/** The warnings `pg-connection-string` raises while it reads a URL. */
async function warningsWhileReading(url: string): Promise<string[]> {
	const seen: string[] = [];
	const listener = (warning: Error) => seen.push(warning.message);
	process.on("warning", listener);
	try {
		sslOf(url);
		await new Promise((resolve) => setImmediate(resolve));
	} finally {
		process.off("warning", listener);
	}
	return seen;
}

describe("the connection string the driver reads", () => {
	it.each([
		"require",
		"prefer",
		"verify-ca",
	])("spells out sslmode=%s as verify-full, which is what the driver does with it", (mode) => {
		const url = `postgres://u:p@db.example.com/app?sslmode=${mode}`;
		expect(normalizeConnectionString(url)).toBe("postgres://u:p@db.example.com/app?sslmode=verify-full");
	});

	it("keeps the connection exactly as secure: the certificate is still verified", () => {
		const normalized = sslOf(normalizeConnectionString("postgres://u:p@db.example.com/app?sslmode=require"));
		// TLS is on, and nothing switches the certificate check off (that is what `no-verify` does).
		expect(normalized).toBeTruthy();
		expect(normalized).not.toMatchObject({ rejectUnauthorized: false });
		expect(normalized).toEqual(sslOf("postgres://u:p@db.example.com/app?sslmode=verify-full"));
		expect(normalized).not.toEqual(sslOf("postgres://u:p@db.example.com/app?sslmode=no-verify"));
	});

	it("leaves the other parameters, and the rest of the URL, as they are", () => {
		expect(
			normalizeConnectionString(
				"postgresql://u:p%40ss@h:5432/db?channel_binding=require&sslmode=require&application_name=x",
			),
		).toBe("postgresql://u:p%40ss@h:5432/db?channel_binding=require&sslmode=verify-full&application_name=x");
	});

	it("leaves a choice the person made alone: no-verify, disable, verify-full, and uselibpqcompat", () => {
		for (const url of [
			"postgres://h/db?sslmode=no-verify",
			"postgres://h/db?sslmode=disable",
			"postgres://h/db?sslmode=verify-full",
			"postgres://h/db?uselibpqcompat=true&sslmode=require",
			"postgres://h/db",
		]) {
			expect(normalizeConnectionString(url)).toBe(url);
		}
	});

	it("does not touch a value that only contains the mode, like a password", () => {
		const url = "postgres://u:sslmode=require@h/db";
		expect(normalizeConnectionString(url)).toBe(url);
	});

	it("the normalized URL makes the driver print no SECURITY WARNING", async () => {
		const normalized = normalizeConnectionString("postgres://u:p@db.example.com/app?sslmode=require");
		expect(await warningsWhileReading(normalized)).toEqual([]);
	});
});

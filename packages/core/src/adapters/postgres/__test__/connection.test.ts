import { describe, expect, it } from "vitest";
import { SSLMODE_FIX, sslmodeWarning } from "../connection";

describe("the sslmode warning of monti doctor", () => {
	it.each(["require", "prefer", "verify-ca"])("explains sslmode=%s and leaves the URL as written", (mode) => {
		const url = `postgres://u:p@db.example.com/app?sslmode=${mode}`;
		expect(sslmodeWarning(url)).toContain(`sslmode=${mode}`);
		expect(sslmodeWarning(url)).toContain("SECURITY WARNING");
	});

	it("says nothing for a mode the driver does not warn about, or when uselibpqcompat is set", () => {
		for (const url of [
			"postgres://h/db",
			"postgres://h/db?sslmode=no-verify",
			"postgres://h/db?sslmode=disable",
			"postgres://h/db?sslmode=verify-full",
			"postgres://h/db?uselibpqcompat=true&sslmode=require",
			"postgres://u:sslmode=require@h/db",
		]) {
			expect(sslmodeWarning(url), url).toBeUndefined();
		}
	});

	it("names the fix", () => {
		expect(SSLMODE_FIX).toContain("sslmode=verify-full");
	});
});

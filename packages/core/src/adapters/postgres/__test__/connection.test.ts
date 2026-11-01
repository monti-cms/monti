import { describe, expect, it } from "vitest";
import { sslmodeWarning } from "../connection";

describe("the sslmode warning of monti doctor", () => {
	it.each(["require", "prefer", "verify-ca"])("DOC-R2 explains sslmode=%s and leaves the URL as written", (mode) => {
		const url = `postgres://u:p@db.example.com/app?sslmode=${mode}`;
		expect(sslmodeWarning(url)).toContain(`sslmode=${mode}`);
		expect(sslmodeWarning(url)).toContain("SECURITY WARNING");
	});
});

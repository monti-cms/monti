import { describe, expect, it } from "vitest";
import { isHomeLink } from "../rules";

describe("isHomeLink", () => {
	it("accepts a path starting with a single slash and an http(s) URL", () => {
		for (const value of ["/", "/en", "/posts/a?x=1", "http://example.com", "https://example.com/home"]) {
			expect(isHomeLink(value)).toBe(true);
		}
	});

	it("rejects an empty value, a relative path, a protocol-relative address and other schemes", () => {
		for (const value of ["", "home", "//example.com", "ftp://example.com", "mailto:a@b.c", "javascript:alert(1)"]) {
			expect(isHomeLink(value)).toBe(false);
		}
	});
});

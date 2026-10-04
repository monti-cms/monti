import { describe, expect, it } from "vitest";
import { siteImageUrl } from "../site-image";

describe("image URLs read by the AI", () => {
	const origin = "https://blog.example";

	it("converts this site's paths to this site's absolute URL", () => {
		expect(siteImageUrl("/images/a.png", origin)?.href).toBe("https://blog.example/images/a.png");
	});

	it("does not read other-site URLs and protocol-relative URLs", () => {
		expect(siteImageUrl("https://other.example/a.png", origin)).toBeNull();
		expect(siteImageUrl("//other.example/a.png", origin)).toBeNull();
		expect(siteImageUrl("/\\other.example/a.png", origin)).toBeNull();
		expect(siteImageUrl("images/a.png", origin)).toBeNull();
	});
});

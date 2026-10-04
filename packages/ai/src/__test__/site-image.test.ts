import { describe, expect, it } from "vitest";
import { siteImageUrl } from "../site-image";

describe("AI가 읽는 이미지 주소", () => {
	const origin = "https://blog.example";

	it("이 사이트 경로는 이 사이트 주소로 바꾼다", () => {
		expect(siteImageUrl("/images/a.png", origin)?.href).toBe("https://blog.example/images/a.png");
	});

	it("다른 사이트 주소와 프로토콜 상대 주소는 읽지 않는다", () => {
		expect(siteImageUrl("https://other.example/a.png", origin)).toBeNull();
		expect(siteImageUrl("//other.example/a.png", origin)).toBeNull();
		expect(siteImageUrl("/\\other.example/a.png", origin)).toBeNull();
		expect(siteImageUrl("images/a.png", origin)).toBeNull();
	});
});

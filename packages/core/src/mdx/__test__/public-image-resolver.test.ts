import { describe, expect, it } from "vitest";
import { createPublicImageResolver } from "../public-image-resolver";

describe("createPublicImageResolver", () => {
	it("외부 주소는 기존 허용 규칙을 그대로 사용한다", async () => {
		const resolve = await createPublicImageResolver('::image{src="/images/a.png"}');

		expect(resolve({ src: "/images/a.png" })).toEqual({ url: "/images/a.png" });
		expect(resolve({ src: "javascript:alert(1)" })).toEqual({ failure: "rejected" });
	});

	it("미디어 저장소를 해석할 수 없으면 실패 결과를 반환한다", async () => {
		const resolve = await createPublicImageResolver('::image{mediaId="00000000-0000-0000-0000-000000000000"}');

		expect(resolve({ mediaId: "00000000-0000-0000-0000-000000000000" })).toEqual({ failure: "unresolved" });
	});
});

import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { CMS_SCHEMA_EXTENSIONS, CmsTextAlign } from "../tiptap-schema";

const schema = getSchema([StarterKit, ...CMS_SCHEMA_EXTENSIONS]);

describe("문단·제목 정렬 설정(§4.3)", () => {
	it("제목·문단에 textAlign 속성이 있고 기본값은 없다", () => {
		// 기본값이 null이라 정렬하지 않은 본문은 `style` 없이 저장된다.
		expect(schema.nodes.heading.spec.attrs?.textAlign?.default).toBeNull();
		expect(schema.nodes.paragraph.spec.attrs?.textAlign?.default).toBeNull();
	});

	it("허용 정렬은 left·center·right 뿐이다(justify 금지, A4)", () => {
		expect(CmsTextAlign.options.alignments).toEqual(["left", "center", "right"]);
		expect(CmsTextAlign.options.types).toEqual(["heading", "paragraph"]);
	});
});

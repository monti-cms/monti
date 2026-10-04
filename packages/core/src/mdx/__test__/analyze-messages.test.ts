import { describe, expect, it } from "vitest";
import { createTranslator } from "../../i18n";
import { analyze } from "../analyze";
import { mdxMessages } from "../messages";

const t = createTranslator(mdxMessages);

describe("MDX 분석 오류는 코드와 값을 싣고 문구는 사전에서 온다", () => {
	it("허용되지 않은 JSX 요소", () => {
		const [error] = analyze("<Unknown />\n").errors;
		expect(error).toMatchObject({ code: "disallowed_jsx_element", params: { name: "Unknown" } });
		expect(error?.message).toBe(t("disallowed_jsx_element", { name: "Unknown" }));
	});

	it("폐기된 요소·표현식·가져오기·함수 호출", () => {
		const codes = (source: string) => analyze(source).errors.map((error) => error.code);
		expect(codes('<ContentLink targetId="x" />')).toEqual(["retired_jsx_element"]);
		expect(codes("import a from 'a'\n")).toEqual(["esm_not_allowed"]);
		expect(codes("{foo()}\n")).toEqual(["call_expression"]);
		expect(codes("{foo}\n")).toEqual(["identifier_reference"]);
	});

	it("파서가 거부한 본문은 파서의 말을 그대로 싣는다", () => {
		const [error] = analyze("<div>\n").errors;
		expect(error?.code).toBe("mdx_syntax");
		expect(error?.message).toBeTruthy();
		expect(error?.position).toEqual({ line: 1, column: 1 });
	});

	it("사전은 모든 코드의 문구를 영어와 한국어로 가진다", () => {
		const en = Object.keys(mdxMessages.messages.en);
		expect(Object.keys(mdxMessages.messages.ko ?? {}).sort()).toEqual([...en].sort());
	});
});

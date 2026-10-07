import { describe, expect, it } from "vitest";
import { testSite } from "../../../core/test/site";
import { analyze } from "../analyze";
import { mdxMessages } from "../messages";

const t = testSite.createTranslator(mdxMessages);

describe("MDX analysis errors carry a code and values, and the message comes from the dictionary", () => {
	it("disallowed JSX element", () => {
		const [error] = analyze(testSite, "<Unknown />\n").errors;
		expect(error).toMatchObject({ code: "disallowed_jsx_element", params: { name: "Unknown" } });
		expect(error?.message).toBe(t("disallowed_jsx_element", { name: "Unknown" }));
	});

	it("retired element, expression, import and function call", () => {
		const codes = (source: string) => analyze(testSite, source).errors.map((error) => error.code);
		expect(codes('<ContentLink targetId="x" />')).toEqual(["retired_jsx_element"]);
		expect(codes("import a from 'a'\n")).toEqual(["esm_not_allowed"]);
		expect(codes("{foo()}\n")).toEqual(["call_expression"]);
		expect(codes("{foo}\n")).toEqual(["identifier_reference"]);
	});

	it("a body rejected by the parser carries the parser's message as is", () => {
		const [error] = analyze(testSite, "<div>\n").errors;
		expect(error?.code).toBe("mdx_syntax");
		expect(error?.message).toBeTruthy();
		expect(error?.position).toEqual({ line: 1, column: 1 });
	});

	it("the dictionary has a message for every code in English and Korean", () => {
		const en = Object.keys(mdxMessages.messages.en);
		expect(Object.keys(mdxMessages.messages.ko ?? {}).sort()).toEqual([...en].sort());
	});
});

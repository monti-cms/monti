import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CmsLink } from "../components/link";

const render = (href: string) => renderToStaticMarkup(<CmsLink href={href}>x</CmsLink>);

describe("CmsLink href handling", () => {
	it.each([
		"#section",
		"/docs/a?b=1#c",
		"mailto:me@example.com",
		"tel:+821012345678",
		"./sibling",
		"../parent/page",
		"relative/path",
		"page.html",
		"?page=2",
		"relative/with:colon",
	])("keeps the href of %s", (href) => {
		expect(render(href)).toBe(`<a href="${href}">x</a>`);
	});

	it("keeps external http(s) links opening in a new window", () => {
		const markup = render("https://example.com/a");
		expect(markup).toContain('href="https://example.com/a"');
		expect(markup).toContain('target="_blank"');
		expect(markup).toContain('class="cms-link-external"');
	});

	it("does not add a target to mailto and tel links", () => {
		expect(render("mailto:me@example.com")).not.toContain("target=");
		expect(render("tel:+821012345678")).not.toContain("target=");
	});

	it.each([
		"javascript:alert(1)",
		"JavaScript:alert(1)",
		"  javascript:alert(1)",
		"\tjavascript:alert(1)",
		"java\tscript:alert(1)",
		"java\nscript:alert(1)",
		"\u0001javascript:alert(1)",
		"vbscript:msgbox(1)",
		"VBScript:msgbox(1)",
		"data:text/html,<script>alert(1)</script>",
		"DATA:text/html;base64,AAAA",
		"file:///etc/passwd",
		"custom-scheme:payload",
		"//evil.example/x",
		"/\\evil.example",
		"\\\\evil.example",
		"\t//evil.example",
		" https://example.com",
	])("drops the href of %j", (href) => {
		expect(render(href)).toBe("<a>x</a>");
	});

	it("renders an empty href without an href attribute", () => {
		expect(render("")).toBe("<a>x</a>");
	});
});

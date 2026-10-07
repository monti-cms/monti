import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { testSite } from "../../../test/site";
import { EMPTY_REFS, type ReadRefs } from "../../doc/document-refs";
import { STORED_DOCUMENT_VERSION, type StoredDocument } from "../../doc/stored-document";
import type { CmsMark, CmsNode } from "../../doc/types";
import { CmsContent, type DocumentComponents, type LinkProps } from "../index";

const ID = "123e4567-e89b-42d3-a456-426614174000";
const GONE = "123e4567-e89b-42d3-a456-426614174001";

const link = (label: string, attrs: CmsMark["attrs"]): CmsNode => ({
	type: "text",
	text: label,
	marks: [{ type: "link", attrs }],
});
const doc = (...content: CmsNode[]): StoredDocument => ({ type: "doc", version: STORED_DOCUMENT_VERSION, content });

const refs: ReadRefs = { ...EMPTY_REFS, links: { [ID]: { path: "/posts/renamed", title: "Renamed", locale: "ko" } } };
type ContentProps = Parameters<typeof CmsContent>[0];
type WithoutCms<T> = T extends unknown ? Omit<T, "cms"> : never;

const cms = { site: testSite };

const render = async (props: WithoutCms<ContentProps>) =>
	renderToStaticMarkup((await CmsContent({ cms, ...props } as ContentProps)) as ReactNode);

describe("rendering links by entry id", () => {
	const body = doc({
		type: "paragraph",
		content: [
			{ type: "text", text: "See " },
			link("it", { entryId: ID }),
			{ type: "text", text: ", " },
			link("gone", { entryId: GONE }),
			{ type: "text", text: " and " },
			link("out", { href: "https://example.com/a" }),
			{ type: "text", text: "." },
		],
	});

	it("draws a link at the address its entry has now, and an unresolved one as plain text", async () => {
		const markup = await render({ doc: body, refs });

		expect(markup).toContain('<a href="/posts/renamed">it</a>');
		expect(markup).toContain("gone");
		expect(markup).not.toContain(GONE);
		expect(markup).not.toMatch(/<a[^>]*>gone/);
		expect(markup).toContain('href="https://example.com/a"');
	});

	it("draws every entry link as plain text without refs", async () => {
		const markup = await render({ doc: body });

		expect(markup).toContain("See it, gone and");
		expect(markup).not.toContain("/posts/renamed");
	});

	it("gives a site's own link component the entry, its address and the id", async () => {
		const seen: LinkProps[] = [];
		const components = {
			marks: {
				link: (props: LinkProps) => {
					seen.push(props);
					return createElement("span", null, props.children);
				},
			},
		} as unknown as DocumentComponents;

		await render({ doc: body, refs, components });

		expect(seen.find((props) => props.entryId === ID)).toMatchObject({
			href: "/posts/renamed",
			entry: { path: "/posts/renamed", title: "Renamed", locale: "ko" },
		});
		expect(seen.find((props) => props.entryId === GONE)).toMatchObject({ href: undefined, entry: undefined });
		expect(seen.find((props) => props.entryId === undefined)).toMatchObject({
			href: "https://example.com/a",
			external: true,
		});
	});
});

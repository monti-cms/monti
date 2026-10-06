import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EMPTY_REFS, type ReadRefs } from "../../mdx/document-refs";
import { entryLinkHref } from "../../mdx/entry-links";
import { bodyFromMdx, type StoredDocument } from "../../mdx/stored-document";
import { CmsContent, type DocumentComponents, type LinkProps } from "../index";

const ID = "123e4567-e89b-42d3-a456-426614174000";
const GONE = "123e4567-e89b-42d3-a456-426614174001";

const doc = (mdx: string): StoredDocument => {
	const body = bodyFromMdx(mdx);
	if (!body.doc) throw new Error("not a document");
	return body.doc;
};

const refs: ReadRefs = { ...EMPTY_REFS, links: { [ID]: { path: "/posts/renamed", title: "Renamed", locale: "ko" } } };
const render = async (props: Parameters<typeof CmsContent>[0]) =>
	renderToStaticMarkup((await CmsContent(props)) as ReactNode);

describe("rendering links by entry id", () => {
	const body = doc(`See [it](${entryLinkHref(ID)}), [gone](${entryLinkHref(GONE)}) and [out](https://example.com/a).`);

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

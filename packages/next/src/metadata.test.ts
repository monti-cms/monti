import { describe, expect, it } from "vitest";
import { homePath, languageLinks, pageMetadata } from "./metadata";

const list = [
	{ code: "ko", name: "한국어" },
	{ code: "en", name: "English" },
	{ code: "ja", name: "日本語" },
];
const locales = { source: "ko", list, prefix: "exceptSource" as const };

describe("the language switcher's links", () => {
	it("16-10 a language's first page follows the site's prefix rule", () => {
		expect(list.map(({ code }) => homePath(locales, code))).toEqual(["/", "/en", "/ja"]);
		expect(list.map(({ code }) => homePath({ ...locales, prefix: "always" }, code))).toEqual(["/ko", "/en", "/ja"]);
		expect(list.map(({ code }) => homePath({ ...locales, prefix: "never" }, code))).toEqual(["/", "/", "/"]);
	});

	it("16-10 each language goes to the same entry in it, and to that language's first page when the entry is not there", () => {
		const page = { locale: "en", path: "/en/posts/hello", translations: [{ locale: "ko", path: "/posts/annyeong" }] };
		expect(languageLinks(locales, page)).toEqual([
			{ locale: "ko", name: "한국어", href: "/posts/annyeong", current: false },
			{ locale: "en", name: "English", href: "/en/posts/hello", current: true },
			{ locale: "ja", name: "日本語", href: "/ja", current: false },
		]);
	});

	it("16-10 a page that names no translations links every language's first page", () => {
		expect(languageLinks(locales, { locale: "ko" }).map((link) => [link.href, link.current])).toEqual([
			["/", true],
			["/en", false],
			["/ja", false],
		]);
	});
});

describe("a page's metadata", () => {
	const page = {
		title: "가을 산행",
		description: "단풍이 든 길",
		locale: "ko",
		path: "/posts/hike",
		translations: [{ locale: "en", path: "/en/posts/hike" }],
	};

	it("16-11 its own address is canonical, the other languages are named, and the share values carry its title and address", () => {
		expect(pageMetadata(page)).toEqual({
			title: "가을 산행",
			description: "단풍이 든 길",
			alternates: { canonical: "/posts/hike", languages: { ko: "/posts/hike", en: "/en/posts/hike" } },
			openGraph: { title: "가을 산행", description: "단풍이 든 길", url: "/posts/hike" },
			twitter: { card: "summary", title: "가을 산행", description: "단풍이 든 길" },
		});
	});

	it("16-11 a share image is on the card at its size, and makes the card a large one", () => {
		const meta = pageMetadata({ ...page, image: { src: "/files/a.jpg", width: 1200, height: 630, alt: "산" } });
		const images = [{ url: "/files/a.jpg", width: 1200, height: 630, alt: "산" }];
		expect(meta.openGraph).toMatchObject({ images });
		expect(meta.twitter).toMatchObject({ card: "summary_large_image", images });
	});

	it("16-11 the address the author named is canonical and shared, and such a page, like a hidden one, names no other languages", () => {
		const elsewhere = pageMetadata({ ...page, canonical: "https://example.com/hike" });
		expect(elsewhere.alternates).toEqual({ canonical: "https://example.com/hike" });
		expect(elsewhere.openGraph).toMatchObject({ url: "https://example.com/hike" });
		const hidden = pageMetadata({ ...page, noindex: true });
		expect(hidden.robots).toEqual({ index: false });
		expect(hidden.alternates).toEqual({ canonical: "/posts/hike" });
	});

	it("16-11 a page in one language only names no languages, and one with no address names no address", () => {
		expect(pageMetadata({ ...page, translations: [] }).alternates).toEqual({ canonical: "/posts/hike" });
		const bare = pageMetadata({ title: "태그", locale: "ko", path: null });
		expect(bare).toEqual({ title: "태그", openGraph: { title: "태그" }, twitter: { card: "summary", title: "태그" } });
	});
});

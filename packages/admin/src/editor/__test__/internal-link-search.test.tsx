import { createTranslator, LINKABLE_COLLECTIONS } from "@monti-cms/core/client";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CmsApiError } from "../../screens/admin-api";
import { InternalLinkPopup } from "../internal-link-popup";
import { searchLinkTargets } from "../internal-link-search";
import { editorMessages } from "../messages";

const t = createTranslator(editorMessages);

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const jsonResponse = (status: number, body: unknown) =>
	new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("searchLinkTargets", () => {
	it("returns the entries of every linkable collection", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const collection = new URL(String(input), "http://localhost").searchParams.get("collection");
			return jsonResponse(200, {
				items: [{ id: `id-${collection}`, collection, title: null, slug: "a", status: "published" }],
			});
		});
		vi.stubGlobal("fetch", fetchMock);
		const items = await searchLinkTargets("a");
		expect(fetchMock).toHaveBeenCalledTimes(LINKABLE_COLLECTIONS.length);
		expect(items.map((item) => item.collection).sort()).toEqual([...LINKABLE_COLLECTIONS].sort());
		// An untitled entry still gets a label.
		expect(items.every((item) => item.title.length > 0)).toBe(true);
	});

	it("asks for one result per translation group, so the id of a result is the id a link stores", async () => {
		const urls: URL[] = [];
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL) => {
				urls.push(new URL(String(input), "http://localhost"));
				return jsonResponse(200, { items: [] });
			}),
		);

		await searchLinkTargets("a");

		expect(urls.length).toBeGreaterThan(0);
		for (const url of urls) expect(url.searchParams.get("group")).toBe("translation");
	});

	it("throws the API error instead of returning an empty list when the request fails", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => jsonResponse(500, { code: "internal", message: "Boom" })),
		);
		const error = await searchLinkTargets("a").catch((caught) => caught);
		expect(error).toBeInstanceOf(CmsApiError);
		expect(error.status).toBe(500);
	});

	it("lets a network failure through as a TypeError", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new TypeError("Failed to fetch");
			}),
		);
		await expect(searchLinkTargets("a")).rejects.toBeInstanceOf(TypeError);
	});
});

describe("InternalLinkPopup", () => {
	const props = {
		items: [],
		isLoading: false,
		coords: { top: 0, left: 0 },
		selectedIndex: 0,
		onSelect: vi.fn(),
		onClose: vi.fn(),
	};

	it("shows the error message instead of the empty-result text", async () => {
		render(<InternalLinkPopup {...props} error="Boom" />);
		expect((await screen.findByRole("alert")).textContent).toBe("Boom");
		expect(screen.queryByText(t("internalLink.empty"))).toBeNull();
	});

	it("shows the empty-result text when there is no error", async () => {
		render(<InternalLinkPopup {...props} error={null} />);
		expect(await screen.findByText(t("internalLink.empty"))).toBeTruthy();
		expect(screen.queryByRole("alert")).toBeNull();
	});
});

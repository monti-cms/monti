import type { ListEntriesItem } from "@monti-cms/core/site";
import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../core/test/site";
import { CmsApiError } from "../../api/client";
import { failure, fakeApi } from "../../test/fake-api";
import { renderWithSite } from "../../test/site";
import { InternalLinkPopup } from "../internal-link-popup";
import { searchLinkTargets } from "../internal-link-search";
import { editorMessages } from "../messages";

const { LINKABLE_COLLECTIONS } = testSite;
const t = testSite.createTranslator(editorMessages);

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const stamp = new Date("2026-10-20T00:00:00Z");
/** One row of the entry list, untitled, as the list API answers it. */
const listRow = (collection: string): ListEntriesItem => ({
	id: `id-${collection}`,
	collection,
	locale: testSite.DEFAULT_LOCALE,
	translationGroupId: `id-${collection}`,
	title: null,
	slug: "a",
	status: "published",
	version: 1,
	folderId: null,
	relations: {},
	values: {},
	hasUnpublishedChanges: false,
	publishedAt: stamp,
	createdAt: stamp,
	updatedAt: stamp,
	deletedAt: null,
});

describe("searchLinkTargets", () => {
	it("returns the entries of every linkable collection", async () => {
		const api = fakeApi()
			.on("GET /v1/entries", ({ query }) => ({ items: [listRow(query.get("collection") ?? "")], total: 1 }))
			.install();
		const items = await searchLinkTargets(testSite, "a");
		expect(api.requests).toHaveLength(LINKABLE_COLLECTIONS.length);
		expect(items.map((item) => item.collection).sort()).toEqual([...LINKABLE_COLLECTIONS].sort());
		// An untitled entry still gets a label.
		expect(items.every((item) => item.title.length > 0)).toBe(true);
	});

	it("asks for one result per translation group, so the id of a result is the id a link stores", async () => {
		const api = fakeApi()
			.on("GET /v1/entries", () => ({ items: [], total: 0 }))
			.install();

		await searchLinkTargets(testSite, "a");

		const sent = api.sent("GET /v1/entries");
		expect(sent.length).toBeGreaterThan(0);
		for (const request of sent) expect(request.query.get("group")).toBe("translation");
	});

	it("throws the API error instead of returning an empty list when the request fails", async () => {
		fakeApi()
			.on("GET /v1/entries", () => failure("internal_error", "Boom"))
			.install();
		const error = await searchLinkTargets(testSite, "a").catch((caught) => caught);
		expect(error).toBeInstanceOf(CmsApiError);
		expect(error.status).toBe(500);
	});

	it("lets a network failure through as a TypeError", async () => {
		fakeApi()
			.on("GET /v1/entries", () => {
				throw new TypeError("Failed to fetch");
			})
			.install();
		await expect(searchLinkTargets(testSite, "a")).rejects.toBeInstanceOf(TypeError);
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
		renderWithSite(<InternalLinkPopup {...props} error="Boom" />);
		expect((await screen.findByRole("alert")).textContent).toBe("Boom");
		expect(screen.queryByText(t("internalLink.empty"))).toBeNull();
	});

	it("shows the empty-result text when there is no error", async () => {
		renderWithSite(<InternalLinkPopup {...props} error={null} />);
		expect(await screen.findByText(t("internalLink.empty"))).toBeInTheDocument();
		expect(screen.queryByRole("alert")).toBeNull();
	});
});

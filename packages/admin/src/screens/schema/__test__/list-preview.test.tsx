import { cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { renderWithSite as render } from "../../__test__/site-wrapper";
import { AdminQueryProvider } from "../../shared/query-provider";
import { ListPreview } from "../list-preview";
import { schemaMessages } from "../messages";

const t = testSite.createTranslator(schemaMessages);
const collection = { kind: "document", fields: { title: { kind: "text", label: "Title" } } };

const row = (title: string) => ({
	title,
	slug: title,
	status: "published",
	locale: "en",
	values: { title },
	relations: {},
	folderId: null,
	publishedAt: null,
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
});

function stubEntries(respond: () => Promise<unknown>) {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => respond()),
	);
}
const ok = (items: unknown[]) => ({ ok: true, status: 200, json: async () => ({ items }) });

const renderPreview = (saved = true) =>
	render(
		<AdminQueryProvider>
			<ListPreview name="post" collection={collection} columns={["title"]} saved={saved} />
		</AdminQueryProvider>,
	);

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("ListPreview", () => {
	it("shows skeleton rows, not sample rows, while a saved collection's entries load", async () => {
		let release: (value: unknown) => void = () => {};
		stubEntries(
			() =>
				new Promise((resolve) => {
					release = resolve;
				}),
		);
		renderPreview();

		expect((await screen.findAllByTestId("list-preview-skeleton")).length).toBeGreaterThan(0);
		expect(screen.queryByText("Title 1")).toBeNull();
		expect(screen.queryByText(t("list.previewSample"))).toBeNull();

		release(ok([row("Hello")]));
		expect(await screen.findByText("Hello")).toBeTruthy();
		expect(screen.queryAllByTestId("list-preview-skeleton")).toHaveLength(0);
		expect(screen.getByText(t("list.previewReal"))).toBeTruthy();
	});

	it("falls back to labelled sample rows once the collection has no entries", async () => {
		stubEntries(async () => ok([]));
		renderPreview();

		expect(await screen.findByText("Title 1")).toBeTruthy();
		expect(screen.getByText(t("list.previewSample"))).toBeTruthy();
		expect(screen.queryAllByTestId("list-preview-skeleton")).toHaveLength(0);
	});

	it("shows sample rows at once for a collection that is not saved yet", async () => {
		renderPreview(false);
		expect(await screen.findByText("Title 1")).toBeTruthy();
		expect(screen.queryAllByTestId("list-preview-skeleton")).toHaveLength(0);
	});

	it("falls back to sample rows when loading the entries fails", async () => {
		stubEntries(async () => ({ ok: false, status: 500, json: async () => ({}) }));
		renderPreview();
		await waitFor(() => expect(screen.queryAllByTestId("list-preview-skeleton")).toHaveLength(0));
		expect(screen.getByText("Title 1")).toBeTruthy();
	});
});

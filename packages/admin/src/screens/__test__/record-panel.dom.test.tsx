import { emptyStoredDocument } from "@monti-cms/core/document";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../core/test/site";
import { commonMessages } from "../../lib/common.messages";
import { fakeApi } from "../../test/fake-api";
import { withSite } from "../../test/site";
import { AdminUiLabels } from "../../ui/labels";
import type { EntryData } from "../entries/entry-form";
import { screensMessages } from "../messages";
import { RecordPanel } from "../record-panel";

const tScreens = testSite.createTranslator(screensMessages);
const tCommon = testSite.createTranslator(commonMessages);
/** The name of the tag's title field, the one field of each language tab. */
const NAME = testSite.titleField("tag").field.label;

const tag: EntryData = {
	id: "tag-1",
	collection: "tag",
	status: "published",
	version: 3,
	folderId: null,
	workingSlug: "react",
	publishedSlug: "react",
	working: { metadata: { title: "리액트", translations: { en: { title: "React" } } }, doc: emptyStoredDocument() },
};

let api: ReturnType<typeof fakeApi>;
const calls = (method: "PATCH" | "POST") => api.requests.filter((request) => request.method === method);

beforeEach(() => {
	api = fakeApi()
		.on("GET /v1/entries/:id", () => tag)
		.on("PATCH /v1/entries/:id", () => ({ entry: { ...tag, version: 4 }, warnings: [] }))
		.on("POST /v1/entries", () => ({ entry: { ...tag, id: "tag-2" }, warnings: [] }))
		.on("GET /v1/entries", () => ({ items: [], total: 0 }))
		.install();
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const renderPanel = (target: { collection: "tag" | "category" | "collection"; id: string | null }) => {
	const onClose = vi.fn();
	const onSaved = vi.fn();
	render(
		withSite(
			<AdminUiLabels>
				<RecordPanel target={target} onClose={onClose} onSaved={onSaved} />
			</AdminUiLabels>,
		),
	);
	return { onClose, onSaved };
};
const panel = () => screen.getByRole("complementary", { name: new RegExp(testSite.COLLECTION_DEFINITIONS.tag.label) });

describe("taxonomy edit panel", () => {
	it("WRITE-W6 on other locale tabs only that locale's name is edited, and it says the slug is the same in all locales", async () => {
		const { onSaved } = renderPanel({ collection: "tag", id: "tag-1" });
		await screen.findByDisplayValue("리액트");

		const japanese = testSite.localeLabel("ja");
		fireEvent.click(within(panel()).getByRole("tab", { name: tScreens("record.translationOff", { name: japanese }) }));
		expect(screen.queryByRole("textbox", { name: tScreens("column.slug") })).toBeNull();
		expect(screen.getByText(tScreens("record.localeEmpty", { name: japanese }))).toBeInTheDocument();
		fireEvent.change(screen.getByRole("textbox", { name: NAME }), { target: { value: "リアクト" } });
		expect(
			within(panel()).getByRole("tab", { name: tScreens("record.translationOn", { name: japanese }) }),
		).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: tCommon("save") }));
		await waitFor(() => expect(calls("PATCH")).toHaveLength(1));
		expect(calls("PATCH")[0]?.body).toMatchObject({
			expectedVersion: 3,
			metadata: { translations: { ja: { title: "リアクト" } } },
		});
		await waitFor(() => expect(onSaved).toHaveBeenCalled());
	});

	it("WRITE-S2 after saving, saves again based on the received revision", async () => {
		renderPanel({ collection: "tag", id: "tag-1" });
		fireEvent.change(await screen.findByDisplayValue("리액트"), { target: { value: "React!" } });
		fireEvent.click(screen.getByRole("button", { name: tCommon("save") }));
		await waitFor(() => expect(calls("PATCH")).toHaveLength(1));
		await waitFor(() =>
			expect((screen.getByRole("button", { name: tCommon("save") }) as HTMLButtonElement).disabled).toBe(false),
		);

		fireEvent.change(screen.getByDisplayValue("React!"), { target: { value: "React!!" } });
		fireEvent.click(screen.getByRole("button", { name: tCommon("save") }));
		await waitFor(() => expect(calls("PATCH")).toHaveLength(2));
		expect(calls("PATCH")[1]?.body.expectedVersion).toBe(4);
	});

	it("WRITE-S6 with unsaved changes, asks whether to discard before closing", async () => {
		const { onClose } = renderPanel({ collection: "tag", id: "tag-1" });
		fireEvent.change(await screen.findByDisplayValue("리액트"), { target: { value: "React!" } });

		fireEvent.click(within(panel()).getByRole("button", { name: tCommon("close") }));
		const dialog = await screen.findByRole("alertdialog", { name: tCommon("discard.title") });
		expect(onClose).not.toHaveBeenCalled();

		fireEvent.click(within(dialog).getByRole("button", { name: tCommon("discard.confirm") }));
		await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
	});
});

import { fireEvent, screen, within } from "@testing-library/react";
import { testSite } from "../../../../../core/test/site";
import { SEO_ADMIN_COMPONENTS } from "../../../../../seo/src/admin/provider";
import { AdminComponentsProvider } from "../../../admin-components";
import { SlotRegistryProvider, type SlotSource } from "../../../slots/slots";
import { type FakeApi, failure, fakeApi } from "../../../test/fake-api";
import { installFakeIndexedDB } from "../../../test/fake-indexed-db";
import { docOf } from "../../../test/mdx";
import { createTestRouter } from "../../../test/router";
import { withSite } from "../../../test/site";
import { AdminUiLabels } from "../../../ui/labels";
import { EntryEditorShell } from "../entry-editor-shell";
import { entryEditorShellMessages } from "../entry-editor-shell.messages";
import type { EntryData } from "../entry-form";

/**
 * The editor of one draft with its properties pane, for the flow "set properties" of the editor board (flow 1, steps 07, 08 and 11). A test gives the
 * collection, the metadata, the other entries the server holds and the assistant's actions; the fake server saves, searches and reads usages.
 */

const tEntryEditorShell = testSite.createTranslator(entryEditorShellMessages);
const { render } = createTestRouter();

export interface PropertiesFlow {
	readonly api: FakeApi;
	/** What the server holds now, by id (the edited entry is `entry-1`). */
	readonly entries: Record<string, EntryData>;
}

/**
 * A server holding the draft `entry-1` of the given collection with `metadata`, and `others`. It saves with a version check, finds nothing and reads no usages;
 * a test that needs more answers those routes again (a later `on` takes over).
 */
export function setUpPropertiesFlow(
	collection: string,
	metadata: Record<string, unknown>,
	others: Record<string, EntryData> = {},
): PropertiesFlow {
	installFakeIndexedDB();
	const entry: EntryData = {
		id: "entry-1",
		collection,
		status: "draft",
		version: 4,
		folderId: null,
		workingSlug: "test",
		publishedSlug: null,
		working: { metadata, doc: docOf("첫째 줄") },
	};
	const entries: Record<string, EntryData> = { "entry-1": entry, ...structuredClone(others) };
	const api = fakeApi()
		.on("GET /v1/entries/:id", ({ params }) => entries[params.id] ?? failure("not_found"))
		.on("PATCH /v1/entries/:id", ({ params, body }) => {
			const current = entries[params.id];
			if (!current) return failure("not_found");
			entries[params.id] = {
				...current,
				version: current.version + 1,
				working: { metadata: body.metadata, doc: body.doc ?? current.working.doc },
			};
			return { entry: entries[params.id], warnings: [] };
		})
		.on("GET /v1/entries/search", () => ({ items: [] }))
		.on("GET /v1/entries", () => ({ items: [], total: 0 }))
		.on("GET /v1/entries/:id/relations", () => ({ incomingReferences: [] }))
		.on("POST /v1/entries/:id/check", () => ({ issues: [], warnings: [] }))
		.install();
	return { api, entries };
}

/** The editor of `entry-1`, with the SEO extension's inputs and the assistant's actions `sources`. */
export const renderEdit = (sources: SlotSource[]) =>
	render(
		withSite(
			<AdminUiLabels>
				<AdminComponentsProvider components={SEO_ADMIN_COMPONENTS}>
					<SlotRegistryProvider sources={sources}>
						<EntryEditorShell mode="edit" initialEntryId="entry-1" adminId="u1" />
					</SlotRegistryProvider>
				</AdminComponentsProvider>
			</AdminUiLabels>,
		),
	);

export const pane = async () =>
	within(await screen.findByRole("complementary", { name: tEntryEditorShell("properties") }));
/** One property of the list: its label names the group. */
export const row = async (label: string) => within((await pane()).getByRole("group", { name: label }));
export const valueButton = async (label: string) =>
	(await row(label)).getByRole("button", { name: new RegExp(`^${label}`) });
export const pressSave = () => fireEvent.keyDown(window, { key: "s", metaKey: true });

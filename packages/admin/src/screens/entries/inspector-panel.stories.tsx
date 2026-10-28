import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { AdminComponentsProvider } from "../../admin-components";
import { SlotRegistryProvider, type SlotSource } from "../../slots/slots";
import { type FakeApi, PageFrame } from "../../stories/screen-frame";
import { EMPTY_FORM, type EntryForm, type EntryFormPatch } from "./entry-form";
import { InspectorPanel } from "./inspector-panel";
import { EntryFormProvider } from "./use-field";

// The properties pane of the editor, on its own: a tab bar over a read list. The server answers the few reads the list makes (the category's name).
const meta = {
	title: "Screens/Entry editor/Properties",
	parameters: { layout: "fullscreen", bleed: true },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const API = "/api/monti/v1";
const server: FakeApi = (path) => {
	if (path.startsWith(`${API}/entries/search`)) {
		return {
			items: path.includes("id=cat-1") ? [{ id: "cat-1", title: "개발", slug: "dev", status: "published" }] : [],
		};
	}
	if (path.endsWith("/relations")) return { incomingReferences: [] };
	return undefined;
};

const base: EntryForm = {
	...EMPTY_FORM,
	title: "첫 번째 글",
	slug: "first-post",
	summary: "",
	categoryId: "cat-1",
};

/** The summary action: it answers after a moment, as a model does, or never (`hold`). */
const summarySource = (hold = false): SlotSource => {
	return (request) =>
		request.target === "summary"
			? [
					{
						id: "summary",
						label: "요약 쓰기",
						apply: "replace",
						run: () =>
							hold
								? new Promise(() => {})
								: new Promise((resolve) =>
										setTimeout(
											() => resolve({ kind: "text", text: "리액트로 블로그를 다시 만들며 덜어낸 것과 남긴 것." }),
											400,
										),
									),
					},
				]
			: [];
};

function Pane({ initial = base, hold = false }: { initial?: EntryForm; hold?: boolean }) {
	const [form, setForm] = useState(initial);
	return (
		<PageFrame api={server} pathname="/admin/entries/entry-1/edit">
			<AdminComponentsProvider
				components={{
					fieldInputs: {
						"seo-title": { Empty: () => <>제목과 같음 · 6/60</> },
						"seo-description": { Empty: () => <>요약과 같음</> },
						"seo-image": { Empty: () => <>기본 이미지와 같음</> },
					},
				}}
			>
				<SlotRegistryProvider sources={[summarySource(hold)]}>
					<EntryFormProvider
						value={{
							collection: "post",
							form,
							setForm: (patch: EntryFormPatch) => setForm((current) => ({ ...current, ...patch })),
						}}
					>
						<div className="flex h-svh justify-end">
							<InspectorPanel
								incomingReferences={[]}
								isLoadingIncomingReferences={false}
								onRefreshIncomingReferences={() => undefined}
								onSlugChange={(slug) => setForm((current) => ({ ...current, slug }))}
								onRegenerateSlug={() => undefined}
							/>
						</div>
					</EntryFormProvider>
				</SlotRegistryProvider>
			</AdminComponentsProvider>
		</PageFrame>
	);
}

const LONG = { timeout: 10000 };

export const Basic: Story = { tags: ["visual"], render: () => <Pane /> };

export const SeoTab: Story = {
	tags: ["visual"],
	render: () => <Pane />,
	play: async ({ canvasElement }) => {
		await userEvent.click(await within(canvasElement).findByRole("tab", { name: "SEO" }, LONG));
		await within(canvasElement).findByText("제목과 같음 · 6/60", undefined, LONG);
	},
};

/** The summary is open in place, with its count at the right end of the label row. */
export const Editing: Story = {
	tags: ["visual"],
	render: () => <Pane initial={{ ...base, summary: "리액트로 블로그를 다시 만들며 덜어낸 것과 남긴 것." }} />,
	play: async ({ canvasElement }) => {
		await userEvent.click(await within(canvasElement).findByRole("button", { name: /^요약/ }, LONG));
		await expect(await within(canvasElement).findByRole("textbox", { name: "요약" })).toBeTruthy();
	},
};

/** "채우기" pressed: the value went in at once and is blue until it is edited. */
export const FilledByAssistant: Story = {
	tags: ["visual"],
	render: () => <Pane />,
	play: async ({ canvasElement }) => {
		await userEvent.click(await within(canvasElement).findByRole("button", { name: "채우기" }, LONG));
		await within(canvasElement).findByRole("button", { name: "다시" }, LONG);
	},
};

/** While the request runs: the spinner and "쓰는 중…". */
export const Writing: Story = {
	render: () => <Pane hold />,
	play: async ({ canvasElement }) => {
		await userEvent.click(await within(canvasElement).findByRole("button", { name: "채우기" }, LONG));
		await within(canvasElement).findByRole("button", { name: "쓰는 중…" }, LONG);
	},
};

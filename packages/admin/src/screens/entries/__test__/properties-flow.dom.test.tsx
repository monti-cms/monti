import { SUMMARY_ROLE } from "@monti-cms/core";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { contentCollection, requiredMetadata } from "../../../../../core/test/any-site";
import { testSite } from "../../../../../core/test/site";
import { SEO_ROLES } from "../../../../../seo/src/fields";
import { seoMessages } from "../../../../../seo/src/messages";
import { commonMessages } from "../../../lib/common.messages";
import type { SlotAction, SlotSource } from "../../../slots/slots";
import { pressOption } from "../../../test/base-ui";
import type { FakeApi } from "../../../test/fake-api";
import { uiMessages } from "../../../ui/messages";
import { entriesMessages } from "../messages";
import { pane, pressSave, renderEdit, row, setUpPropertiesFlow, valueButton } from "./properties-flow.fixture";

const tEntries = testSite.createTranslator(entriesMessages);
const tCommon = testSite.createTranslator(commonMessages);
const tUi = testSite.createTranslator(uiMessages);
const tSeo = testSite.createTranslator(seoMessages);
/** What the assistant's mark reads, on a value and on its open input. */
const ASSISTED = tUi("proposal");

// The flow "set properties" of the editor board (flow 1, steps 07, 08 and 11): the 300px properties pane is a tab bar over a read list; a value opens for editing
// where it is; the SEO tab reads what each empty value follows; "채우기" writes the value at once and marks it as the assistant's until it is edited. They check
// what a screenshot cannot: the requests, the focus, the keys, the roles and names and the accessible state. The fields are found in the site's config by
// what they are (the summary, the SEO extension's roles); the series rows, which only the blog has, are in `properties-flow.blog.dom.test.tsx`.

vi.mock("@monti-cms/ui", async (importOriginal) =>
	(await import("../../../test/ui-toast")).withToast(await importOriginal<typeof import("@monti-cms/ui")>()),
);

const schema = testSite.schemaOf(contentCollection);
const labelOf = (name: string) => schema.fields[name]?.label ?? name;
const groups = testSite.panelGroupsOf(contentCollection);
/** The tabs of the pane: the default one, then the tabs the layout and the plugins add. */
const TABS = [...new Set(["", ...groups.map((group) => group.tab)])];
const SLUG = labelOf("slug");
const SUMMARY_FIELD = testSite.roleField(contentCollection, SUMMARY_ROLE);
if (!SUMMARY_FIELD) throw new Error(`${contentCollection} has no summary field`);
const SUMMARY = SUMMARY_FIELD.field.label;
/** The first named group of the default tab, with the fields it lists. */
const GROUP = groups.find((group) => group.tab === "" && group.group && group.fields.length > 1);
/** A choice the default tab shows (a select, or the choice that switches a conditional field), and an option other than the one it starts at. */
const CHOICE = (() => {
	for (const group of groups.filter((candidate) => candidate.tab === "")) {
		for (const name of group.fields) {
			const field = schema.fields[name];
			const select = field?.kind === "conditional" ? field.discriminant : field?.kind === "select" ? field : undefined;
			if (!field || !select) continue;
			const option = Object.entries(select.options).find(([value]) => value !== select.defaultValue);
			const label = field.kind === "conditional" ? field.label : select.label;
			if (option) return { name, label, value: option[0], text: String(option[1]) };
		}
	}
	return undefined;
})();
/** The SEO extension's fields, by role, and the tab its plugin puts them in. */
const seoField = (role: string) => {
	const stored = testSite.roleField(contentCollection, role);
	if (!stored) throw new Error(`${contentCollection} has no field with the SEO role ${role}`);
	return stored;
};
const SEO_TITLE = seoField(SEO_ROLES.title);
const SEO_TAB = groups.find((group) => group.fields.includes(SEO_TITLE.name))?.tab ?? "";
const SEO_LIMIT = (SEO_TITLE.field as { inputOptions?: { limit?: number } }).inputOptions?.limit;

let api: FakeApi;

beforeEach(async () => {
	// The draft holds what publishing asks for, with the summary still empty.
	const metadata = await requiredMetadata(contentCollection, "테스트", async () => "target-1");
	({ api } = setUpPropertiesFlow(contentCollection, { ...metadata, [SUMMARY_FIELD.name]: "" }));
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const fill: SlotAction = {
	id: "fill-summary",
	label: "요약 쓰기",
	apply: "replace",
	run: vi.fn(async () => ({ kind: "text" as const, text: "리액트로 블로그를 다시 만들며 덜어낸 것과 남긴 것." })),
};
const summarySource: SlotSource = (request) =>
	request.slot === "field" && request.target === SUMMARY_FIELD.name ? [fill] : [];
const saved = () => api.sent("PATCH /v1/entries/:id");

describe("flow: set properties (steps 07, 08, 11)", () => {
	it("WRITE-W3 is the properties pane: a tab bar over a list, with no head and no close button", async () => {
		renderEdit([summarySource]);
		const panel = await pane();
		expect(panel.getAllByRole("tab")).toHaveLength(TABS.length);
		expect(panel.getByRole("tab", { name: SEO_TAB })).toBeInTheDocument();
		expect(panel.getByRole("tab", { name: tEntries("tab.default") }).getAttribute("aria-selected")).toBe("true");
		expect(panel.queryByRole("button", { name: tCommon("close") })).toBeNull();
		expect(panel.queryByRole("heading", { level: 2 })).toBeNull();
	});

	it.skipIf(!GROUP)(
		"WRITE-W3 reads as a list: the label above its value, and the group name as a subheading",
		async () => {
			renderEdit([summarySource]);
			expect((await valueButton(SLUG)).textContent).toBe("/test");
			expect((await valueButton(SUMMARY)).textContent).toBe(tEntries("property.empty"));
			const group = (await pane()).getByRole("region", { name: GROUP?.group });
			for (const name of GROUP?.fields ?? [])
				expect(within(group).getByRole("group", { name: labelOf(name) })).toBeInTheDocument();
			// At rest nothing is a box: no text field is on the screen besides the title.
			expect((await pane()).queryAllByRole("textbox")).toEqual([]);
		},
	);

	it("WRITE-W3 a value opens for editing where it is, takes the caret, and the edit goes in the saved request", async () => {
		renderEdit([summarySource]);
		fireEvent.click(await valueButton(SUMMARY));
		const box = await (await row(SUMMARY)).findByRole("textbox");
		expect(document.activeElement).toBe(box);
		fireEvent.change(box, { target: { value: "새 요약" } });
		act(() => box.blur());
		await waitFor(async () => expect((await row(SUMMARY)).queryByRole("textbox")).toBeNull());
		expect((await valueButton(SUMMARY)).textContent).toBe("새 요약");
		pressSave();
		await waitFor(() => expect(saved()).toHaveLength(1));
		expect(saved()[0]?.body.metadata[SUMMARY_FIELD.name]).toBe("새 요약");
	});

	it("WRITE-W3 Enter ends a one-line value, Escape ends any value, and the typed text stays", async () => {
		renderEdit([summarySource]);
		fireEvent.click(await valueButton(SLUG));
		const slug = await (await row(SLUG)).findByRole("textbox");
		fireEvent.change(slug, { target: { value: "hello" } });
		fireEvent.keyDown(slug, { key: "Enter" });
		await waitFor(async () => expect((await row(SLUG)).queryByRole("textbox")).toBeNull());
		expect((await valueButton(SLUG)).textContent).toBe("/hello");

		fireEvent.click(await valueButton(SUMMARY));
		const box = await (await row(SUMMARY)).findByRole("textbox");
		fireEvent.change(box, { target: { value: "줄 하나" } });
		// A multi-line value takes Enter as a new line: it stays open.
		fireEvent.keyDown(box, { key: "Enter" });
		expect((await row(SUMMARY)).getByRole("textbox")).toBeInTheDocument();
		fireEvent.keyDown(box, { key: "Escape" });
		await waitFor(async () => expect((await row(SUMMARY)).queryByRole("textbox")).toBeNull());
		expect((await valueButton(SUMMARY)).textContent).toBe("줄 하나");
	});

	it.skipIf(!CHOICE)("WRITE-W3 a select opens its list; the pick closes it and goes in the request", async () => {
		const choice = CHOICE as NonNullable<typeof CHOICE>;
		renderEdit([summarySource]);
		fireEvent.click(await valueButton(choice.label));
		pressOption(await screen.findByRole("option", { name: choice.text }));

		await waitFor(async () => expect((await valueButton(choice.label)).textContent).toBe(choice.text));
		pressSave();
		await waitFor(() => expect(saved()).toHaveLength(1));
		expect(saved()[0]?.body.metadata[choice.name]).toBe(choice.value);
	});

	it("WRITE-W3 the SEO tab is a read list of what each empty value follows, with no preview boxes", async () => {
		renderEdit([summarySource]);
		fireEvent.click((await pane()).getByRole("tab", { name: SEO_TAB }));
		// The title "테스트" is 3 of the characters a search title may have.
		const count = `3/${SEO_LIMIT}`;
		expect((await valueButton(SEO_TITLE.field.label)).textContent).toBe(`${tSeo("same.title")} · ${count}`);
		expect((await valueButton(seoField(SEO_ROLES.description).field.label)).textContent).toBe(tSeo("same.description"));
		expect((await valueButton(seoField(SEO_ROLES.image).field.label)).textContent).toBe(tSeo("same.image"));
		expect((await valueButton(seoField(SEO_ROLES.noindex).field.label)).textContent).toBe(tSeo("option.index"));
		// No preview box: the tab holds its values and no region of its own.
		expect((await pane()).queryAllByRole("region")).toEqual([]);
		// Opening the title shows its count and the title as the hint.
		fireEvent.click(await valueButton(SEO_TITLE.field.label));
		const box = await (await row(SEO_TITLE.field.label)).findByRole("textbox");
		expect((box as HTMLInputElement).placeholder).toBe("테스트");
		expect((await row(SEO_TITLE.field.label)).getByText(count)).toBeInTheDocument();
	});

	it("ASSIST-F1 fills the empty summary at once, marks it as the assistant's, and an edit takes the mark off", async () => {
		renderEdit([summarySource]);
		expect((await row(SUMMARY)).queryByRole("button", { name: tUi("ai.again") })).toBeNull();
		fireEvent.click((await row(SUMMARY)).getByRole("button", { name: tUi("ai.fill") }));
		await waitFor(async () => expect((await valueButton(SUMMARY)).textContent).toContain("리액트로 블로그를"));
		expect(fill.run).toHaveBeenCalledWith(
			expect.objectContaining({ collection: contentCollection, title: "테스트" }),
			expect.anything(),
		);
		// The value is in place without a step to accept it.
		expect((await valueButton(SUMMARY)).getAttribute("aria-description")).toBe(ASSISTED);
		// The action now asks again.
		expect((await row(SUMMARY)).getByRole("button", { name: tUi("ai.again") })).toBeInTheDocument();
		fireEvent.click(await valueButton(SUMMARY));
		const box = await (await row(SUMMARY)).findByRole("textbox");
		expect(box.getAttribute("aria-description")).toBe(ASSISTED);
		fireEvent.change(box, { target: { value: "고친 요약" } });
		expect(box.getAttribute("aria-description")).toBeNull();
		act(() => box.blur());
		await waitFor(async () => expect((await valueButton(SUMMARY)).getAttribute("aria-description")).toBeNull());
	});
});

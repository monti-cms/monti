import "@testing-library/jest-dom/vitest";
import { buildEditorExtensions } from "@monti-cms/admin/editor";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import type { EditorFieldProposalItem, EditorProposals } from "../../../admin-components";
import { tiptapOf } from "../../../test/mdx";
import { SiteWrapper } from "../../../test/site";
import { proposalMarksMessages } from "../messages";
import { FIELD_PROPOSAL_ATTRIBUTE, type FieldProposals, useProposalMarks } from "../use-proposal-marks";

const t = testSite.createTranslator(proposalMarksMessages);

let editor: Editor | null = null;
afterEach(() => {
	editor?.destroy();
	editor = null;
});

let latest: FieldProposals = { byField: new Map(), current: null };

/** The hook, with the place in the properties panel a drawn field change hangs its card from. */
function Harness({
	source,
	values,
	set,
	editor,
}: {
	source: EditorProposals;
	values: Record<string, unknown>;
	set: (patch: Readonly<Record<string, unknown>>) => void;
	editor: Editor;
}) {
	const marks = useProposalMarks([source], undefined, { values, set });
	latest = marks.fieldProposals;
	useEffect(() => marks.onEditor(editor), [marks.onEditor, editor]);
	return (
		<>
			{marks.fieldProposals.byField.has("blurb") && <span {...{ [FIELD_PROPOSAL_ATTRIBUTE]: "blurb" }}>blurb</span>}
			{marks.overlay}
		</>
	);
}

const blurb: EditorFieldProposalItem = {
	id: "f1",
	request: "summarize",
	field: "blurb",
	before: null,
	value: "A short summary.",
};

const setUp = (values: Record<string, unknown>) => {
	editor = new Editor({ extensions: buildEditorExtensions(testSite), content: tiptapOf("One paragraph.") });
	const set = vi.fn();
	const onAcceptField = vi.fn();
	const source: EditorProposals = {
		items: [],
		fieldItems: [blurb],
		onAccept: vi.fn(),
		onAcceptField,
		onDiscard: vi.fn(),
	};
	render(<Harness source={source} values={values} set={set} editor={editor} />, { wrapper: SiteWrapper });
	return { set, onAcceptField };
};

describe("field changes in the editor", () => {
	it("ASSIST-E5 draws a field change whose field still reads as planned (empty in the form is empty as stored), and the bubble starts on it", async () => {
		setUp({ blurb: "" });
		await waitFor(() => expect(latest.byField.get("blurb")).toMatchObject({ value: "A short summary." }));
		expect(latest.current).toBe("blurb");
	});

	it("ASSIST-E5 leaves out a field change whose field the admin changed meanwhile", async () => {
		setUp({ blurb: "Written by a person." });
		await waitFor(() => expect(latest.byField.size).toBe(0));
	});

	it("ASSIST-E5 accepts a field change from its card into the form and tells the source", async () => {
		const { set, onAcceptField } = setUp({ blurb: "" });
		await waitFor(() => expect(latest.byField.has("blurb")).toBe(true));
		act(() => latest.byField.get("blurb")?.open());
		fireEvent.click(await screen.findByRole("button", { name: t("accept") }));
		expect(set).toHaveBeenCalledWith({ blurb: "A short summary." });
		expect(onAcceptField).toHaveBeenCalledWith(blurb);
	});
});

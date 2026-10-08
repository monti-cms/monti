// @vitest-environment jsdom
import { CmsAdminComponentsProvider } from "@monti-cms/admin";
import { buildEditorExtensions, storedToTiptap, tiptapToStored } from "@monti-cms/admin/editor";
import { defineSite } from "@monti-cms/core";
import { createSite, SiteProvider } from "@monti-cms/core/client";
import { assignBlockIds, emptyStoredDocument, type StoredDocument } from "@monti-cms/core/document";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect } from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { schema } from "../site";
import { notice } from "./index";
import { NoticeProvider } from "./provider";

afterEach(cleanup);

// jsdom has no coordinates for text ranges, and ProseMirror asks for them after the cursor moves.
beforeAll(() => {
	for (const proto of [Range.prototype, Text.prototype] as unknown as Record<string, unknown>[]) {
		proto.getClientRects ??= () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] });
		proto.getBoundingClientRect ??= () => new DOMRect(0, 0, 0, 0);
	}
});

// In the browser the site comes from the admin layout (`<SiteProvider config={cms.site.snapshot()}>`). A test builds the same site from the same config.
// (`defineConfig` is server-only and refuses to run where `window` exists, so a browser test uses `defineSite`.)
const site = createSite(defineSite({ schema, plugins: [notice()] }));

const stored: StoredDocument = {
	...emptyStoredDocument(),
	content: assignBlockIds([
		{
			type: "notice",
			attrs: { level: "info", title: "" },
			content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
		},
	]),
};

function Harness({ onReady }: { onReady: (editor: Editor) => void }) {
	const editor = useEditor({
		extensions: buildEditorExtensions(site),
		content: storedToTiptap(site, stored),
		immediatelyRender: true,
	});
	useEffect(() => {
		if (editor) onReady(editor);
	}, [editor, onReady]);
	return <EditorContent editor={editor} />;
}

describe("notice editor view", () => {
	it("draws the registered view, and its controls write the block's attributes", async () => {
		const mounted: { editor?: Editor } = {};
		render(
			<SiteProvider site={site}>
				<NoticeProvider>
					<Harness
						onReady={(ready) => {
							mounted.editor = ready;
						}}
					/>
				</NoticeProvider>
			</SiteProvider>,
		);
		const level = await screen.findByRole("button", { name: "Info" });

		fireEvent.click(level);
		await waitFor(() => expect(screen.getByRole("button", { name: "Warning" })).toBeTruthy());
		fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Heads up" } });

		const saved = tiptapToStored(site, (mounted.editor as Editor).getJSON());
		expect(saved.content[0]).toMatchObject({ type: "notice", attrs: { level: "warn", title: "Heads up" } });
	});

	it("is a plain provider: another provider can register the same block name and win", async () => {
		render(
			<SiteProvider site={site}>
				<NoticeProvider>
					<CmsAdminComponentsProvider components={{ blockViews: { notice: () => <p>site view</p> } }}>
						<Harness onReady={() => undefined} />
					</CmsAdminComponentsProvider>
				</NoticeProvider>
			</SiteProvider>,
		);
		expect(await screen.findByText("site view")).toBeTruthy();
	});
});

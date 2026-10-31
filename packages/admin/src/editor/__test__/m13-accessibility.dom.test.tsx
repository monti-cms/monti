import { image } from "@monti-cms/core/site";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import type { NodeViewProps } from "@tiptap/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { contentCollection } from "../../../../core/test/any-site";
import { testSite } from "../../../../core/test/site";
import { commonMessages } from "../../lib/common.messages";
import { withBlockEditor } from "../../test/block-editor";
import { renderInRouter as render } from "../../test/router";
import { ImageBlockView } from "../image-node-view";
import { InternalLinkPopup } from "../internal-link-popup";
import { editorMediaMessages } from "../media.messages";
import { editorMessages } from "../messages";
import { slashCommands } from "../slash-command";
import { SlashMenuPopup } from "../slash-menu-popup";

const tEditorMedia = testSite.createTranslator(editorMediaMessages);
const tEditor = testSite.createTranslator(editorMessages);
const tc = testSite.createTranslator(commonMessages);

vi.mock("@tiptap/react", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@tiptap/react")>();
	const react = await import("react");
	return {
		...actual,
		NodeViewWrapper: ({
			as = "figure",
			children,
			...props
		}: { as?: "figure"; children?: ReactNode } & Omit<ComponentProps<"figure">, "children">) =>
			react.createElement(as, props, children),
	};
});

afterEach(cleanup);

const CmsImageNodeView = withBlockEditor(ImageBlockView, image);

describe("editor accessibility", () => {
	it("MEDIA-W1 names image controls and exposes alignment state", async () => {
		const updateAttributes = vi.fn();
		const deleteNode = vi.fn();
		const nodeViewProps = {
			node: {
				attrs: {
					src: "/test-image.png",
					alt: "A test image",
					width: "100%",
					align: "center",
					caption: "",
					mediaId: null,
				},
			},
			updateAttributes,
			deleteNode,
			selected: false,
		} as unknown as NodeViewProps;
		render(
			<>
				<CmsImageNodeView {...nodeViewProps} />
			</>,
		);

		expect(screen.getByRole("button", { name: tEditorMedia("imageNode.alignLeft") }).getAttribute("aria-pressed")).toBe(
			"false",
		);
		expect(
			screen.getByRole("button", { name: tEditorMedia("imageNode.alignCenter") }).getAttribute("aria-pressed"),
		).toBe("true");
		fireEvent.click(screen.getByRole("button", { name: tEditorMedia("imageNode.alignLeft") }));
		expect(updateAttributes).toHaveBeenCalledWith({ align: "left" });
		// Delete lives only in the block handle menu (the same action is not placed in two spots).
		expect(screen.queryByRole("button", { name: tc("delete") })).toBeNull();
	});

	it("EDIT-L2 lets keyboard-focused suggestions activate and close", async () => {
		const onSelectSlash = vi.fn();
		const onCloseSlash = vi.fn();
		const paragraph = slashCommands(testSite).find((command) => command.title === tEditor("slash.paragraph.title"));
		render(
			<SlashMenuPopup
				items={paragraph ? [paragraph] : []}
				query=""
				caret={{ top: 0, bottom: 0, left: 0 }}
				selectedIndex={0}
				onSelect={onSelectSlash}
				onHighlight={vi.fn()}
				onClose={onCloseSlash}
			/>,
		);
		const slashOption = await screen.findByRole("option", {
			name: (name) => name.startsWith(tEditor("slash.paragraph.title")),
		});
		expect(slashOption.getAttribute("aria-selected")).toBe("true");
		fireEvent.mouseDown(slashOption);
		expect(onSelectSlash).not.toHaveBeenCalled();
		fireEvent.click(slashOption);
		expect(onSelectSlash).toHaveBeenCalledOnce();
		fireEvent.keyDown(slashOption, { key: "Escape" });
		expect(onCloseSlash).toHaveBeenCalledOnce();

		const onSelectLink = vi.fn();
		const onCloseLink = vi.fn();
		render(
			<InternalLinkPopup
				items={[{ id: "entry-1", collection: contentCollection, title: "테스트 글", slug: "test-post" }]}
				isLoading={false}
				coords={{ top: 0, left: 0 }}
				selectedIndex={0}
				onSelect={onSelectLink}
				onClose={onCloseLink}
			/>,
		);
		const linkOption = screen.getByRole("option", { name: /테스트 글/ });
		fireEvent.mouseDown(linkOption);
		expect(onSelectLink).not.toHaveBeenCalled();
		fireEvent.click(linkOption);
		expect(onSelectLink).toHaveBeenCalledOnce();
		fireEvent.keyDown(linkOption, { key: "Escape" });
		expect(onCloseLink).toHaveBeenCalledOnce();
	});
});

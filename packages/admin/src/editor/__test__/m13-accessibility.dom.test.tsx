import { image } from "@monti-cms/core/site";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import type { NodeViewProps } from "@tiptap/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../core/test/site";
import { withBlockEditor } from "../../test/block-editor";
import { renderInRouter as render } from "../../test/router";
import { ImageBlockView } from "../image-node-view";
import { InternalLinkPopup } from "../internal-link-popup";
import { editorMediaMessages } from "../media.messages";
import { slashCommands } from "../slash-command";
import { SlashMenuPopup } from "../slash-menu-popup";

const tEditorMedia = testSite.createTranslator(editorMediaMessages);

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
		expect(screen.queryByRole("button", { name: "이미지 삭제" })).toBeNull();
	});

	it("assigns unique IDs to each image editor field", async () => {
		const props = {
			node: { attrs: { src: "/test-image.png", alt: "", width: "100%", align: "center", caption: "", mediaId: null } },
			updateAttributes: vi.fn(),
			deleteNode: vi.fn(),
			selected: false,
		} as unknown as NodeViewProps;
		render(
			<>
				<CmsImageNodeView {...props} />
				<CmsImageNodeView {...props} />
			</>,
		);

		// Only one settings popover is open at a time. Open them in turn and collect each input's ID.
		const widthIds: string[] = [];
		const altIds: string[] = [];
		for (const button of screen.getAllByRole("button", { name: tEditorMedia("imageNode.settings") })) {
			fireEvent.click(button);
			const width = await screen.findByLabelText(tEditorMedia("imageNode.width"));
			widthIds.push(width.id);
			altIds.push(screen.getByLabelText(tEditorMedia("imageNode.alt")).id);
			fireEvent.keyDown(width, { key: "Escape" });
			await waitFor(() => expect(screen.queryByLabelText(tEditorMedia("imageNode.alt"))).toBeNull());
		}
		expect(new Set(widthIds).size).toBe(2);
		expect(new Set(altIds).size).toBe(2);
	});

	it("EDIT-L2 lets keyboard-focused suggestions activate and close", async () => {
		const onSelectSlash = vi.fn();
		const onCloseSlash = vi.fn();
		render(
			<SlashMenuPopup
				items={[slashCommands(testSite)[0]]}
				query=""
				caret={{ top: 0, bottom: 0, left: 0 }}
				selectedIndex={0}
				onSelect={onSelectSlash}
				onHighlight={vi.fn()}
				onClose={onCloseSlash}
			/>,
		);
		const slashOption = await screen.findByRole("option", { name: /문단/ });
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
				items={[{ id: "entry-1", collection: "post", title: "테스트 글", slug: "test-post" }]}
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

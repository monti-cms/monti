import { image } from "@monti-cms/core/site";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import type { NodeViewProps } from "@tiptap/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../core/test/site";
import { commonMessages } from "../../lib/common.messages";
import { withBlockEditor } from "../../test/block-editor";
import { renderWithSite } from "../../test/site";
import { ImageBlockView } from "../image-node-view";
import { editorMediaMessages } from "../media.messages";

const t = testSite.createTranslator(editorMediaMessages);
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

describe("CmsImageNodeView", () => {
	const createProps = (attrs: Record<string, unknown> = {}, isEditable = true) => {
		const updateAttributes = vi.fn();
		const deleteNode = vi.fn();
		const props = {
			node: {
				attrs: {
					src: "https://example.com/test.png",
					alt: "테스트 이미지",
					width: "100%",
					align: "center",
					caption: "",
					mediaId: null,
					crop: null,
					rotate: null,
					...attrs,
				},
			},
			updateAttributes,
			deleteNode,
			selected: false,
			editor: { isEditable },
		} as unknown as NodeViewProps;
		return { props, updateAttributes, deleteNode };
	};

	it("clearing alt text in the settings popover shows an error there, and decorative images are turned on with the switch", async () => {
		const { props, updateAttributes } = createProps({ alt: "" });
		renderWithSite(<CmsImageNodeView {...props} />);
		fireEvent.click(screen.getByRole("button", { name: t("imageNode.settings") }));
		expect((await screen.findByRole("alert")).textContent).toBe(t("imageNode.altRequired"));
		fireEvent.click(screen.getByRole("switch", { name: t("imageNode.decorative") }));
		expect(updateAttributes).toHaveBeenCalledWith({ decorative: true, alt: "" });
	});

	it("hides the tool row and has no delete button when read-only", () => {
		const { props } = createProps({}, false);
		renderWithSite(<CmsImageNodeView {...props} />);
		expect(screen.queryByRole("toolbar", { name: t("imageNode.toolbar") })).toBeNull();
		cleanup();
		renderWithSite(<CmsImageNodeView {...createProps().props} />);
		expect(screen.getByRole("toolbar", { name: t("imageNode.toolbar") })).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /삭제/ })).toBeNull();
	});

	it("renders the width resize corner handle and updates in a single transaction on drag", () => {
		const { props, updateAttributes } = createProps({ width: "500px" });
		renderWithSite(<CmsImageNodeView {...props} />);

		const leftHandle = screen.getByLabelText(t("imageNode.resizeLeft"));
		const rightHandle = screen.getByLabelText(t("imageNode.resizeRight"));
		expect(leftHandle).toBeInTheDocument();
		expect(rightHandle).toBeInTheDocument();

		// Simulate pointerdown, then window pointermove and pointerup
		fireEvent.pointerDown(rightHandle, { clientX: 100, pointerId: 1 });
		act(() => {
			window.dispatchEvent(new PointerEvent("pointermove", { clientX: 200 }));
			window.dispatchEvent(new PointerEvent("pointerup"));
		});

		expect(updateAttributes).toHaveBeenCalledOnce();
		expect(updateAttributes.mock.calls[0][0].width).toMatch(/^\d+px$/);
	});

	it("for % widths, computes and updates a % value on drag", () => {
		const { props, updateAttributes } = createProps({ width: "60%" });
		renderWithSite(<CmsImageNodeView {...props} />);

		const rightHandle = screen.getByLabelText(t("imageNode.resizeRight"));
		fireEvent.pointerDown(rightHandle, { clientX: 100, pointerId: 1 });
		act(() => {
			window.dispatchEvent(new PointerEvent("pointermove", { clientX: 150 }));
			window.dispatchEvent(new PointerEvent("pointerup"));
		});

		expect(updateAttributes).toHaveBeenCalledOnce();
		expect(updateAttributes.mock.calls[0][0].width).toMatch(/^\d+%$/);
	});

	it("can open the crop and rotate sheet and perform rotate and apply", () => {
		const { props, updateAttributes } = createProps();
		renderWithSite(<CmsImageNodeView {...props} />);

		const cropBtn = screen.getByRole("button", { name: t("imageCrop.title") });
		fireEvent.click(cropBtn);

		// Confirm the sheet is open
		expect(screen.getByRole("dialog", { name: t("imageCrop.title") })).toBeInTheDocument();

		// Click the 90-degree rotate button
		const rotateBtn = screen.getByRole("button", { name: t("imageCrop.rotate90") });
		fireEvent.click(rotateBtn);
		expect(screen.getByText("90°")).toBeInTheDocument();

		// Click the apply button
		const applyBtn = screen.getByRole("button", { name: tc("apply") });
		fireEvent.click(applyBtn);

		expect(updateAttributes).toHaveBeenCalledWith({
			crop: null,
			rotate: "90",
		});
	});

	it("does not call updateAttributes when the width handle is released without moving (preserves images with no width set)", () => {
		const { props, updateAttributes } = createProps({ width: null });
		renderWithSite(<CmsImageNodeView {...props} />);

		const rightHandle = screen.getByLabelText(t("imageNode.resizeRight"));
		// Plain click and release without moving
		fireEvent.pointerDown(rightHandle, { clientX: 100, pointerId: 1 });
		act(() => {
			window.dispatchEvent(new PointerEvent("pointerup"));
		});

		expect(updateAttributes).not.toHaveBeenCalled();
	});

	it("stores the crop coordinates relative to the original (0-100) even when rotated", () => {
		const { props, updateAttributes } = createProps({ rotate: "90" });
		renderWithSite(<CmsImageNodeView {...props} />);

		const cropBtn = screen.getByRole("button", { name: t("imageCrop.title") });
		fireEvent.click(cropBtn);

		// Keyboard numeric input alternative for X, Y, W, H
		const inputX = screen.getByLabelText(t("imageCrop.x"));
		const inputY = screen.getByLabelText(t("imageCrop.y"));
		const inputW = screen.getByLabelText(t("imageCrop.width"));
		const inputH = screen.getByLabelText(t("imageCrop.height"));

		fireEvent.change(inputX, { target: { value: "15" } });
		fireEvent.change(inputY, { target: { value: "25" } });
		fireEvent.change(inputW, { target: { value: "50" } });
		fireEvent.change(inputH, { target: { value: "60" } });

		// Click the apply button
		const applyBtn = screen.getByRole("button", { name: tc("apply") });
		fireEvent.click(applyBtn);

		expect(updateAttributes).toHaveBeenCalledWith({
			crop: "15,25,50,60",
			rotate: "90",
		});
	});

	it("reset in the sheet reverts both crop and rotation", () => {
		const { props, updateAttributes } = createProps({
			crop: "10,10,80,80",
			rotate: "180",
		});
		renderWithSite(<CmsImageNodeView {...props} />);

		const cropBtn = screen.getByRole("button", { name: t("imageCrop.title") });
		fireEvent.click(cropBtn);

		// Click the reset button
		const resetAllBtn = screen.getByRole("button", { name: tc("reset") });
		fireEvent.click(resetAllBtn);

		// Click the apply button
		const applyBtn = screen.getByRole("button", { name: tc("apply") });
		fireEvent.click(applyBtn);

		expect(updateAttributes).toHaveBeenCalledWith({
			crop: null,
			rotate: null,
		});
	});
});

import { createTranslator } from "@monti-cms/core/client";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { NodeViewProps } from "@tiptap/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { blocksMessages } from "../blocks/messages";
import { ALT_REQUIRED_MESSAGE } from "../image-insert-dialog";
import { CmsImageNodeView } from "../image-node-view";
import { editorMessages } from "../messages";

const t = createTranslator(editorMessages);
const tBlocks = createTranslator(blocksMessages);

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

describe("CmsImageNodeView (v2 C2)", () => {
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

	it("설정 팝오버에서 대체 텍스트를 비우면 그 자리에 오류를 보이고, 장식 이미지는 스위치로 켠다", async () => {
		const { props, updateAttributes } = createProps({ alt: "" });
		render(<CmsImageNodeView {...props} />);
		fireEvent.click(screen.getByRole("button", { name: tBlocks("settings.label") }));
		expect((await screen.findByRole("alert")).textContent).toBe(ALT_REQUIRED_MESSAGE);
		fireEvent.click(screen.getByRole("switch", { name: t("imageDialog.decorative") }));
		expect(updateAttributes).toHaveBeenCalledWith({ decorative: true, alt: "" });
	});

	it("읽기 전용이면 도구 줄을 숨기고 삭제 버튼은 두지 않는다", () => {
		const { props } = createProps({}, false);
		render(<CmsImageNodeView {...props} />);
		expect(screen.queryByRole("toolbar", { name: t("imageNode.toolbar") })).toBeNull();
		cleanup();
		render(<CmsImageNodeView {...createProps().props} />);
		expect(screen.getByRole("toolbar", { name: t("imageNode.toolbar") })).toBeTruthy();
		expect(screen.queryByRole("button", { name: /삭제/ })).toBeNull();
	});

	it("너비 조절 모서리 핸들을 렌더링하고 드래그 시 한번의 트랜잭션으로 업데이트한다", () => {
		const { props, updateAttributes } = createProps({ width: "500px" });
		render(<CmsImageNodeView {...props} />);

		const leftHandle = screen.getByLabelText(t("imageNode.resizeLeft"));
		const rightHandle = screen.getByLabelText(t("imageNode.resizeRight"));
		expect(leftHandle).toBeDefined();
		expect(rightHandle).toBeDefined();

		// pointerdown 후 window pointermove, pointerup 시뮬레이션
		fireEvent.pointerDown(rightHandle, { clientX: 100, pointerId: 1 });
		act(() => {
			window.dispatchEvent(new PointerEvent("pointermove", { clientX: 200 }));
			window.dispatchEvent(new PointerEvent("pointerup"));
		});

		expect(updateAttributes).toHaveBeenCalledOnce();
		expect(updateAttributes.mock.calls[0][0].width).toMatch(/^\d+px$/);
	});

	it("% 너비의 경우 드래그 시 % 값으로 계산하여 업데이트한다", () => {
		const { props, updateAttributes } = createProps({ width: "60%" });
		render(<CmsImageNodeView {...props} />);

		const rightHandle = screen.getByLabelText(t("imageNode.resizeRight"));
		fireEvent.pointerDown(rightHandle, { clientX: 100, pointerId: 1 });
		act(() => {
			window.dispatchEvent(new PointerEvent("pointermove", { clientX: 150 }));
			window.dispatchEvent(new PointerEvent("pointerup"));
		});

		expect(updateAttributes).toHaveBeenCalledOnce();
		expect(updateAttributes.mock.calls[0][0].width).toMatch(/^\d+%$/);
	});

	it("crop 및 rotate 속성이 있으면 transform wrapper가 렌더된다", () => {
		const { props } = createProps({
			crop: "10,20,50,40",
			rotate: "90",
		});
		const { container } = render(<CmsImageNodeView {...props} />);
		const wrapper = container.querySelector('[data-slot="image-transform-wrapper"]');
		expect(wrapper).toBeTruthy();
	});

	it("자르기 및 회전 대화상자를 열고 회전 및 적용을 수행할 수 있다", () => {
		const { props, updateAttributes } = createProps();
		render(<CmsImageNodeView {...props} />);

		const cropBtn = screen.getByRole("button", { name: t("imageCrop.title") });
		fireEvent.click(cropBtn);

		// 다이얼로그 열림 확인
		expect(screen.getByRole("dialog", { name: t("imageCrop.title") })).toBeDefined();

		// 90도 회전 버튼 클릭
		const rotateBtn = screen.getByRole("button", { name: t("imageCrop.rotate90") });
		fireEvent.click(rotateBtn);
		expect(screen.getByText("90°")).toBeDefined();

		// 적용 버튼 클릭
		const applyBtn = screen.getByRole("button", { name: t("imageCrop.apply") });
		fireEvent.click(applyBtn);

		expect(updateAttributes).toHaveBeenCalledWith({
			crop: null,
			rotate: "90",
		});
	});

	it("너비 핸들을 이동 없이 놓으면 updateAttributes를 호출하지 않는다 (P1-4: 너비 미지정 이미지 보존)", () => {
		const { props, updateAttributes } = createProps({ width: null });
		render(<CmsImageNodeView {...props} />);

		const rightHandle = screen.getByLabelText(t("imageNode.resizeRight"));
		// 이동 없이 단순 클릭 후 놓음
		fireEvent.pointerDown(rightHandle, { clientX: 100, pointerId: 1 });
		act(() => {
			window.dispatchEvent(new PointerEvent("pointerup"));
		});

		expect(updateAttributes).not.toHaveBeenCalled();
	});

	it("pointercancel 발생 시 updateAttributes를 호출하지 않고 정리된다 (P2)", () => {
		const { props, updateAttributes } = createProps({ width: "400px" });
		render(<CmsImageNodeView {...props} />);

		const rightHandle = screen.getByLabelText(t("imageNode.resizeRight"));
		fireEvent.pointerDown(rightHandle, { clientX: 100, pointerId: 1 });
		act(() => {
			window.dispatchEvent(new PointerEvent("pointermove", { clientX: 200 }));
			window.dispatchEvent(new PointerEvent("pointercancel"));
		});

		expect(updateAttributes).not.toHaveBeenCalled();
	});

	it("회전된 상태에서도 크롭 좌표계는 원본 기준(0~100)으로 저장된다 (P1-2)", () => {
		const { props, updateAttributes } = createProps({ rotate: "90" });
		render(<CmsImageNodeView {...props} />);

		const cropBtn = screen.getByRole("button", { name: t("imageCrop.title") });
		fireEvent.click(cropBtn);

		// X, Y, W, H 키보드 수치 입력 대안 (P2)
		const inputX = screen.getByLabelText(t("imageCrop.x"));
		const inputY = screen.getByLabelText(t("imageCrop.y"));
		const inputW = screen.getByLabelText(t("imageCrop.width"));
		const inputH = screen.getByLabelText(t("imageCrop.height"));

		fireEvent.change(inputX, { target: { value: "15" } });
		fireEvent.change(inputY, { target: { value: "25" } });
		fireEvent.change(inputW, { target: { value: "50" } });
		fireEvent.change(inputH, { target: { value: "60" } });

		// 적용 버튼 클릭
		const applyBtn = screen.getByRole("button", { name: t("imageCrop.apply") });
		fireEvent.click(applyBtn);

		expect(updateAttributes).toHaveBeenCalledWith({
			crop: "15,25,50,60",
			rotate: "90",
		});
	});

	it("대화상자에서 초기화가 자르기와 회전을 함께 되돌린다", () => {
		const { props, updateAttributes } = createProps({
			crop: "10,10,80,80",
			rotate: "180",
		});
		render(<CmsImageNodeView {...props} />);

		const cropBtn = screen.getByRole("button", { name: t("imageCrop.title") });
		fireEvent.click(cropBtn);

		// 초기화 버튼 클릭
		const resetAllBtn = screen.getByRole("button", { name: t("imageCrop.reset") });
		fireEvent.click(resetAllBtn);

		// 적용 버튼 클릭
		const applyBtn = screen.getByRole("button", { name: t("imageCrop.apply") });
		fireEvent.click(applyBtn);

		expect(updateAttributes).toHaveBeenCalledWith({
			crop: null,
			rotate: null,
		});
	});
});

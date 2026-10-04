import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { NodeViewProps } from "@tiptap/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type FenceEditorMeta, FencePreviewNodeView } from "../fence-preview-node-view";
import { LazyFencePreview, MathPreview, PreviewErrorBoundary } from "../preview-renderers";

vi.mock("@tiptap/react", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@tiptap/react")>();
	const react = await import("react");
	return {
		...actual,
		NodeViewWrapper: ({
			as = "div",
			children,
			...props
		}: { as?: string; children?: ReactNode } & ComponentProps<"div">) => react.createElement(as, props, children),
	};
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

const createNodeViewProps = (
	typeName: "cmsMermaid" | "cmsChart" | "cmsMath",
	value: string,
	selected = false,
	updateAttributes = vi.fn(),
): NodeViewProps => {
	return {
		node: {
			type: { name: typeName },
			attrs: { value },
		},
		updateAttributes,
		selected,
		editor: { isEditable: true },
	} as unknown as NodeViewProps;
};

/** 노드 종류에 맞는 이름·미리보기. 수식은 KaTeX, 나머지는 사이트가 넣는 미리보기(없으면 원문)다. */
const metaOf = (typeName: string): FenceEditorMeta =>
	typeName === "cmsMath"
		? {
				kind: "math",
				label: "수식",
				placeholder: "E = mc^2",
				preview: (value) => <MathPreview value={value} />,
			}
		: {
				kind: typeName === "cmsChart" ? "chart" : "mermaid",
				label: typeName === "cmsChart" ? "차트" : "다이어그램",
				placeholder: "",
				preview: (value) => <LazyFencePreview lang="mermaid" label="다이어그램" value={value} emptyText="비었음" />,
			};

const View = (props: NodeViewProps) => <FencePreviewNodeView {...props} meta={metaOf(props.node.type.name)} />;

describe("FencePreviewNodeView", () => {
	it("선택되지 않았을 때는 textarea 없이 미리보기만 보여 준다", () => {
		const props = createNodeViewProps("cmsMermaid", "graph TD;\n  A-->B;", false);
		const { container } = render(<View {...props} />);

		expect(container.querySelector("textarea")).toBeNull();
		expect(container.querySelector('[data-fence-preview="mermaid"]')).toBeDefined();
	});

	it("선택되었을 때(selected=true) textarea와 미리보기가 동시에 표시된다", () => {
		const props = createNodeViewProps("cmsChart", 'pie\n  "A": 10', true);
		const { container } = render(<View {...props} />);

		const textarea = container.querySelector("textarea");
		expect(textarea).not.toBeNull();
		expect((textarea as HTMLTextAreaElement).value).toBe('pie\n  "A": 10');
	});

	it("미리보기 클릭 시 편집 모드로 전환되어 textarea가 나타난다", async () => {
		const props = createNodeViewProps("cmsMath", "E = mc^2", false);
		const { container } = render(<View {...props} />);

		expect(container.querySelector("textarea")).toBeNull();

		const button = screen.getByRole("button", { name: /수식/i });
		fireEvent.click(button);

		await waitFor(() => {
			expect(container.querySelector("textarea")).not.toBeNull();
		});
	});

	it("textarea 내용 변경 시 디바운스(400ms) 후 updateAttributes가 호출된다", () => {
		vi.useFakeTimers();
		const updateAttributes = vi.fn();
		const props = createNodeViewProps("cmsMath", "x = 1", true, updateAttributes);
		const { container } = render(<View {...props} />);

		const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
		expect(textarea).not.toBeNull();

		fireEvent.change(textarea, { target: { value: "x = 2" } });
		// 400ms 이전에는 아직 커밋되지 않음
		expect(updateAttributes).not.toHaveBeenCalled();

		// 400ms 경과 후 커밋
		act(() => {
			vi.advanceTimersByTime(400);
		});
		expect(updateAttributes).toHaveBeenCalledWith({ value: "x = 2" });
	});

	it("블러(blur) 시 대기 중인 변경사항이 즉시 커밋된다", () => {
		const updateAttributes = vi.fn();
		const props = createNodeViewProps("cmsMath", "x = 1", true, updateAttributes);
		const { container } = render(<View {...props} />);

		const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
		fireEvent.change(textarea, { target: { value: "x = immediate" } });
		expect(updateAttributes).not.toHaveBeenCalled();

		fireEvent.blur(textarea);
		expect(updateAttributes).toHaveBeenCalledWith({ value: "x = immediate" });
	});

	it("IME 조합 중에는 커밋되지 않고, 조합 완료(compositionend) 시 즉시 커밋된다", () => {
		vi.useFakeTimers();
		const updateAttributes = vi.fn();
		const props = createNodeViewProps("cmsMath", "x = 1", true, updateAttributes);
		const { container } = render(<View {...props} />);

		const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
		expect(textarea).not.toBeNull();

		// IME 입력 시작
		fireEvent.compositionStart(textarea);
		fireEvent.change(textarea, { target: { value: "x = 한" } });
		act(() => {
			vi.advanceTimersByTime(500);
		});
		// 디바운스 시간이 지나도 조합 중 값은 커밋하지 않음
		expect(updateAttributes).not.toHaveBeenCalled();

		// IME 입력 완료
		textarea.value = "x = 한글";
		fireEvent.compositionEnd(textarea);
		expect(updateAttributes).toHaveBeenCalledWith({ value: "x = 한글" });
	});

	it("IME 조합 중 언마운트되면 입력 중인 값을 잃지 않는다", () => {
		const updateAttributes = vi.fn();
		const props = createNodeViewProps("cmsMath", "x = 1", true, updateAttributes);
		const { container, unmount } = render(<View {...props} />);
		const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
		fireEvent.compositionStart(textarea);
		fireEvent.change(textarea, { target: { value: "x = 한" } });
		unmount();
		expect(updateAttributes).toHaveBeenCalledWith({ value: "x = 한" });
	});

	it("커서 키와 Mod 조합은 입력 칸 안에 두고, 저장(Mod-s)만 대기 중 입력을 커밋한 뒤 통과시킨다", () => {
		const props = createNodeViewProps("cmsMermaid", "graph TD", true);
		const { container } = render(<View {...props} />);
		const textarea = container.querySelector("textarea") as HTMLTextAreaElement;

		for (const init of [
			{ key: "Enter" },
			{ key: "ArrowDown" },
			{ key: "Backspace" },
			{ key: "Tab" },
			{ key: "a", metaKey: true },
			{ key: "z", metaKey: true },
		]) {
			const event = new KeyboardEvent("keydown", { ...init, bubbles: true, cancelable: true });
			const stopSpy = vi.spyOn(event, "stopPropagation");
			textarea.dispatchEvent(event);
			expect(stopSpy).toHaveBeenCalled();
		}

		fireEvent.change(textarea, { target: { value: "graph LR" } });
		expect(props.updateAttributes).not.toHaveBeenCalled();
		const save = new KeyboardEvent("keydown", { key: "s", metaKey: true, bubbles: true, cancelable: true });
		const stopSpy = vi.spyOn(save, "stopPropagation");
		textarea.dispatchEvent(save);
		expect(stopSpy).not.toHaveBeenCalled();
		expect(props.updateAttributes).toHaveBeenCalledWith({ value: "graph LR" });
	});

	it("사라질 때 대기 중인 입력을 커밋한다", () => {
		const props = createNodeViewProps("cmsMermaid", "graph TD", true);
		const { container, unmount } = render(<View {...props} />);
		const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
		fireEvent.change(textarea, { target: { value: "graph BT" } });
		unmount();
		expect(props.updateAttributes).toHaveBeenCalledWith({ value: "graph BT" });
	});
});

describe("MathPreview 수식 렌더러 오류 처리", () => {
	it("잘못된 수식 입력 시 destructive 토큰 스타일의 오류 문구를 표시하고 원문은 건드리지 않는다", async () => {
		const { container } = render(<MathPreview value="\\invalidMacro{" />);

		await waitFor(() => {
			const errorBox = container.querySelector(".text-cms-destructive");
			expect(errorBox).not.toBeNull();
			expect(errorBox?.textContent).toContain("KaTeX parse error");
		});
	});

	it("정상적인 수식은 KaTeX 결과물을 표시한다", async () => {
		const { container } = render(<MathPreview value="a^2 + b^2 = c^2" />);

		await waitFor(() => {
			expect(container.querySelector(".katex")).not.toBeNull();
		});
	});
});

describe("PreviewErrorBoundary resetKey", () => {
	it("resetKey 변경 시 에러 상태를 초기화하고 자식을 다시 렌더링한다", () => {
		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const Bomb = ({ shouldThrow }: { shouldThrow: boolean }) => {
			if (shouldThrow) throw new Error("폭탄 에러");
			return <div>정상 렌더링</div>;
		};

		const { container, rerender } = render(
			<PreviewErrorBoundary resetKey="error-key">
				<Bomb shouldThrow={true} />
			</PreviewErrorBoundary>,
		);

		expect(container.textContent).toContain("폭탄 에러");

		// resetKey 변경하여 정상 렌더링 복구
		rerender(
			<PreviewErrorBoundary resetKey="good-key">
				<Bomb shouldThrow={false} />
			</PreviewErrorBoundary>,
		);

		expect(container.textContent).toContain("정상 렌더링");
		expect(container.textContent).not.toContain("폭탄 에러");
		consoleSpy.mockRestore();
	});
});

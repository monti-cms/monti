import { math } from "@monti-cms/core/client";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import type { NodeViewProps } from "@tiptap/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithSite } from "../../../../test/site";
import { BlockEditorProvider } from "../../use-block-editor";
import { type FenceEditorMeta, FencePreviewBlockView } from "../fence-preview-node-view";
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

/** Name and preview for the node type. Math uses KaTeX; the rest use the preview the site provides (the raw source if none). */
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

const View = (props: NodeViewProps) => (
	<BlockEditorProvider nodeView={props} definition={math}>
		<FencePreviewBlockView meta={metaOf(props.node.type.name)} />
	</BlockEditorProvider>
);

describe("FencePreviewBlockView", () => {
	it("shows only the preview, without a textarea, when not selected", () => {
		const props = createNodeViewProps("cmsMermaid", "graph TD;\n  A-->B;", false);
		const { container } = renderWithSite(<View {...props} />);

		expect(container.querySelector("textarea")).toBeNull();
		expect(container.querySelector('[data-fence-preview="mermaid"]')).toBeDefined();
	});

	it("shows both the textarea and the preview when selected (selected=true)", () => {
		const props = createNodeViewProps("cmsChart", 'pie\n  "A": 10', true);
		const { container } = renderWithSite(<View {...props} />);

		const textarea = container.querySelector("textarea");
		expect(textarea).not.toBeNull();
		expect((textarea as HTMLTextAreaElement).value).toBe('pie\n  "A": 10');
	});

	it("clicking the preview switches to edit mode and shows the textarea", async () => {
		const props = createNodeViewProps("cmsMath", "E = mc^2", false);
		const { container } = renderWithSite(<View {...props} />);

		expect(container.querySelector("textarea")).toBeNull();

		const button = screen.getByRole("button", { name: /수식/i });
		fireEvent.click(button);

		await waitFor(() => {
			expect(container.querySelector("textarea")).not.toBeNull();
		});
	});

	it("updateAttributes is called after the debounce (400ms) when the textarea content changes", () => {
		vi.useFakeTimers();
		const updateAttributes = vi.fn();
		const props = createNodeViewProps("cmsMath", "x = 1", true, updateAttributes);
		const { container } = renderWithSite(<View {...props} />);

		const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
		expect(textarea).not.toBeNull();

		fireEvent.change(textarea, { target: { value: "x = 2" } });
		// Not yet committed before 400ms
		expect(updateAttributes).not.toHaveBeenCalled();

		// Committed after 400ms
		act(() => {
			vi.advanceTimersByTime(400);
		});
		expect(updateAttributes).toHaveBeenCalledWith({ value: "x = 2" });
	});

	it("pending changes are committed immediately on blur", () => {
		const updateAttributes = vi.fn();
		const props = createNodeViewProps("cmsMath", "x = 1", true, updateAttributes);
		const { container } = renderWithSite(<View {...props} />);

		const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
		fireEvent.change(textarea, { target: { value: "x = immediate" } });
		expect(updateAttributes).not.toHaveBeenCalled();

		fireEvent.blur(textarea);
		expect(updateAttributes).toHaveBeenCalledWith({ value: "x = immediate" });
	});

	it("does not commit during IME composition, and commits immediately on compositionend", () => {
		vi.useFakeTimers();
		const updateAttributes = vi.fn();
		const props = createNodeViewProps("cmsMath", "x = 1", true, updateAttributes);
		const { container } = renderWithSite(<View {...props} />);

		const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
		expect(textarea).not.toBeNull();

		// IME input starts
		fireEvent.compositionStart(textarea);
		fireEvent.change(textarea, { target: { value: "x = 한" } });
		act(() => {
			vi.advanceTimersByTime(500);
		});
		// Even after the debounce time, the value being composed is not committed
		expect(updateAttributes).not.toHaveBeenCalled();

		// IME input ends
		textarea.value = "x = 한글";
		fireEvent.compositionEnd(textarea);
		expect(updateAttributes).toHaveBeenCalledWith({ value: "x = 한글" });
	});

	it("does not lose the value being typed if unmounted during IME composition", () => {
		const updateAttributes = vi.fn();
		const props = createNodeViewProps("cmsMath", "x = 1", true, updateAttributes);
		const { container, unmount } = renderWithSite(<View {...props} />);
		const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
		fireEvent.compositionStart(textarea);
		fireEvent.change(textarea, { target: { value: "x = 한" } });
		unmount();
		expect(updateAttributes).toHaveBeenCalledWith({ value: "x = 한" });
	});

	it("keeps cursor keys and Mod combos in the input, and only save (Mod-s) commits pending input and passes through", () => {
		const props = createNodeViewProps("cmsMermaid", "graph TD", true);
		const { container } = renderWithSite(<View {...props} />);
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

	it("commits pending input when it disappears", () => {
		const props = createNodeViewProps("cmsMermaid", "graph TD", true);
		const { container, unmount } = renderWithSite(<View {...props} />);
		const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
		fireEvent.change(textarea, { target: { value: "graph BT" } });
		unmount();
		expect(props.updateAttributes).toHaveBeenCalledWith({ value: "graph BT" });
	});
});

describe("MathPreview math renderer error handling", () => {
	it("shows an error message in destructive token style for invalid math input and leaves the source untouched", async () => {
		const { container } = renderWithSite(<MathPreview value="\\invalidMacro{" />);

		await waitFor(() => {
			const errorBox = container.querySelector(".text-cms-destructive");
			expect(errorBox).not.toBeNull();
			expect(errorBox?.textContent).toContain("KaTeX parse error");
		});
	});

	it("renders valid math as KaTeX output", async () => {
		const { container } = renderWithSite(<MathPreview value="a^2 + b^2 = c^2" />);

		await waitFor(() => {
			expect(container.querySelector(".katex")).not.toBeNull();
		});
	});
});

describe("PreviewErrorBoundary resetKey", () => {
	it("resets the error state and re-renders children when resetKey changes", () => {
		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const Bomb = ({ shouldThrow }: { shouldThrow: boolean }) => {
			if (shouldThrow) throw new Error("폭탄 에러");
			return <div>정상 렌더링</div>;
		};

		const { container, rerender } = renderWithSite(
			<PreviewErrorBoundary resetKey="error-key">
				<Bomb shouldThrow={true} />
			</PreviewErrorBoundary>,
		);

		expect(container.textContent).toContain("폭탄 에러");

		// Change resetKey to recover normal rendering
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

import { math } from "@monti-cms/core/site";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import type { NodeViewProps } from "@tiptap/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../../core/test/site";
import { renderWithSite } from "../../../../test/site";
import { blocksMessages } from "../../messages";
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

const tBlocks = testSite.createTranslator(blocksMessages);
/** The source field of an open block. */
const sourceField = () => screen.getByRole("textbox", { name: tBlocks("fence.sourceCode") }) as HTMLTextAreaElement;

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

const createNodeViewProps = (
	typeName: "cmsDiagram" | "cmsChart" | "cmsMath",
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
				kind: typeName === "cmsChart" ? "chart" : "diagram",
				label: typeName === "cmsChart" ? "차트" : "다이어그램",
				placeholder: "",
				preview: (value) => <LazyFencePreview lang="diagram" label="다이어그램" value={value} emptyText="비었음" />,
			};

const View = (props: NodeViewProps) => (
	<BlockEditorProvider nodeView={props} definition={math}>
		<FencePreviewBlockView meta={metaOf(props.node.type.name)} />
	</BlockEditorProvider>
);

describe("FencePreviewBlockView", () => {
	it("EDIT-B4 clicking the preview switches to edit mode and shows the textarea", async () => {
		const props = createNodeViewProps("cmsMath", "E = mc^2", false);
		renderWithSite(<View {...props} />);

		expect(screen.queryByRole("textbox", { name: tBlocks("fence.sourceCode") })).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: tBlocks("fence.edit", { label: metaOf("cmsMath").label }) }));

		await waitFor(() => expect(sourceField()).toHaveValue("E = mc^2"));
	});

	it("EDIT-B4 pending changes are committed immediately on blur", () => {
		const updateAttributes = vi.fn();
		const props = createNodeViewProps("cmsMath", "x = 1", true, updateAttributes);
		renderWithSite(<View {...props} />);

		const textarea = sourceField();
		fireEvent.change(textarea, { target: { value: "x = immediate" } });
		expect(updateAttributes).not.toHaveBeenCalled();

		fireEvent.blur(textarea);
		expect(updateAttributes).toHaveBeenCalledWith({ value: "x = immediate" });
	});

	it("EDIT-B4 does not commit during IME composition, and commits immediately on compositionend", () => {
		vi.useFakeTimers();
		const updateAttributes = vi.fn();
		const props = createNodeViewProps("cmsMath", "x = 1", true, updateAttributes);
		renderWithSite(<View {...props} />);

		const textarea = sourceField();

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

	it("EDIT-B4 does not lose the value being typed if unmounted during IME composition", () => {
		const updateAttributes = vi.fn();
		const props = createNodeViewProps("cmsMath", "x = 1", true, updateAttributes);
		const { unmount } = renderWithSite(<View {...props} />);
		const textarea = sourceField();
		fireEvent.compositionStart(textarea);
		fireEvent.change(textarea, { target: { value: "x = 한" } });
		unmount();
		expect(updateAttributes).toHaveBeenCalledWith({ value: "x = 한" });
	});

	it("WRITE-S4 keeps cursor keys and Mod combos in the input, and only save (Mod-s) commits pending input and passes through", () => {
		const props = createNodeViewProps("cmsDiagram", "graph TD", true);
		// The editor around the block stands outside: it must not see the keys the input keeps, and must see save.
		const outside = vi.fn();
		renderWithSite(
			// biome-ignore lint/a11y/noStaticElementInteractions: stands in for the editor that listens around the block
			<div onKeyDown={(event) => outside(event.key)}>
				<View {...props} />
			</div>,
		);
		const textarea = sourceField();

		for (const init of [
			{ key: "Enter" },
			{ key: "ArrowDown" },
			{ key: "Backspace" },
			{ key: "Tab" },
			{ key: "a", metaKey: true },
			{ key: "z", metaKey: true },
		]) {
			fireEvent.keyDown(textarea, init);
		}
		expect(outside).not.toHaveBeenCalled();

		fireEvent.change(textarea, { target: { value: "graph LR" } });
		expect(props.updateAttributes).not.toHaveBeenCalled();
		fireEvent.keyDown(textarea, { key: "s", metaKey: true });
		expect(outside).toHaveBeenCalledWith("s");
		expect(props.updateAttributes).toHaveBeenCalledWith({ value: "graph LR" });
	});

	it("EDIT-B4 commits pending input when it disappears", () => {
		const props = createNodeViewProps("cmsDiagram", "graph TD", true);
		const { unmount } = renderWithSite(<View {...props} />);
		fireEvent.change(sourceField(), { target: { value: "graph BT" } });
		unmount();
		expect(props.updateAttributes).toHaveBeenCalledWith({ value: "graph BT" });
	});
});

describe("MathPreview math renderer error handling", () => {
	it("EDIT-B4 shows the parser's message in place of invalid math and leaves the source untouched", async () => {
		const invalid = "\\invalidMacro{";
		// The message KaTeX itself gives for the input: the preview shows it in place of the math.
		const katex = (await import("katex")).default;
		const message = (() => {
			try {
				katex.renderToString(invalid, { displayMode: true, throwOnError: true });
			} catch (error) {
				return (error as Error).message;
			}
			throw new Error("the input is valid math");
		})();
		const updateAttributes = vi.fn();
		renderWithSite(<View {...createNodeViewProps("cmsMath", invalid, true, updateAttributes)} />);

		expect(await screen.findByText(message)).toBeInTheDocument();
		expect(sourceField()).toHaveValue(invalid);
		expect(updateAttributes).not.toHaveBeenCalled();
	});
});

describe("PreviewErrorBoundary resetKey", () => {
	it("EDIT-B5 resets the error state and re-renders children when resetKey changes", () => {
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

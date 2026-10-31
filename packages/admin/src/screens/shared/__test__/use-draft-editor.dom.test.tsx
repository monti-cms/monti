import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDraftEditor } from "../use-draft-editor";

type Draft = { name: string; note: string };
const EMPTY: Draft = { name: "", note: "" };

describe("useDraftEditor", () => {
	it("PLUG-A11 treats a new item with nothing entered as clean, and with something entered as dirty", () => {
		const { result } = renderHook(() => useDraftEditor<Draft>({ saved: null, empty: EMPTY }));
		expect(result.current.isNew).toBe(true);
		expect(result.current.dirty).toBe(false);
		act(() => result.current.update({ name: "a" }));
		expect(result.current.dirty).toBe(true);
		act(() => result.current.reset());
		expect(result.current.dirty).toBe(false);
	});

	it("PLUG-A11 compares an existing item with what the server holds", () => {
		const saved: Draft = { name: "x", note: "" };
		const { result } = renderHook(() => useDraftEditor<Draft>({ saved, empty: EMPTY }));
		expect(result.current.isNew).toBe(false);
		expect(result.current.dirty).toBe(false);
		act(() => result.current.update({ name: "y" }));
		expect(result.current.dirty).toBe(true);
		act(() => result.current.update({ name: "x" }));
		expect(result.current.dirty).toBe(false);
	});

	it("PLUG-A11 starts again from the server's copy after a save", () => {
		const { result, rerender } = renderHook(
			({ saved }: { saved: Draft }) => useDraftEditor<Draft>({ saved, empty: EMPTY }),
			{ initialProps: { saved: { name: "x", note: "" } } },
		);
		act(() => result.current.update({ name: "y" }));
		rerender({ saved: { name: "y", note: "" } });
		expect(result.current.draft.name).toBe("y");
		expect(result.current.dirty).toBe(false);
	});

	it("PLUG-A11 reports dirtiness once per change even when the callback is a new function each render", () => {
		const calls: boolean[] = [];
		const { result, rerender, unmount } = renderHook(() =>
			useDraftEditor<Draft>({ saved: null, empty: EMPTY, onDirtyChange: (dirty) => calls.push(dirty) }),
		);
		rerender();
		rerender();
		expect(calls).toEqual([false]);
		act(() => result.current.update({ name: "a" }));
		expect(calls).toEqual([false, true]);
		unmount();
		expect(calls.at(-1)).toBe(false);
	});

	it("is busy while saving or deleting", () => {
		const { result } = renderHook(() => useDraftEditor<Draft>({ saved: null, empty: EMPTY, saving: true }));
		expect(result.current.busy).toBe(true);
		const onDirtyChange = vi.fn();
		renderHook(() => useDraftEditor<Draft>({ saved: null, empty: EMPTY, onDirtyChange }));
		expect(onDirtyChange).toHaveBeenCalledWith(false);
	});
});

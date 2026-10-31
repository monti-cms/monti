import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NoticeError } from "../../api/client";
import { type EditorResult, type SlotActionsOptions, useSlotActions } from "../../hooks/public";
import { SiteWrapper } from "../../test/site";
import { type SlotAction, SlotRegistryProvider, type SlotResult, type SlotSource } from "../registry";

afterEach(cleanup);

const candidates = (...values: string[]): SlotResult => ({
	kind: "candidates",
	items: values.map((value) => ({ value, label: value })),
});

const action = (overrides: Partial<SlotAction> = {}): SlotAction => ({
	id: "suggest",
	label: "Suggest",
	apply: "replace",
	run: async () => candidates("alpha", "beta"),
	...overrides,
});

const options = (overrides: Partial<SlotActionsOptions> = {}): SlotActionsOptions => ({
	slot: "field",
	target: "title",
	collection: "post",
	getContext: () => ({ title: "Hello" }),
	apply: vi.fn(),
	...overrides,
});

const wrap =
	(sources: SlotSource[]) =>
	({ children }: { children: ReactNode }) => (
		<SiteWrapper>
			<SlotRegistryProvider sources={sources}>{children}</SlotRegistryProvider>
		</SiteWrapper>
	);

/** A run the test finishes by hand, and the signal the run received. */
function deferred() {
	let resolve: (result: SlotResult) => void = () => {};
	let reject: (error: unknown) => void = () => {};
	let signal: AbortSignal | undefined;
	const run = vi.fn<SlotAction["run"]>(
		(_context, abortSignal) =>
			new Promise<SlotResult>((res, rej) => {
				signal = abortSignal;
				resolve = res;
				reject = rej;
			}),
	);
	return { run, resolve: (r: SlotResult) => resolve(r), reject: (e: unknown) => reject(e), signal: () => signal };
}

describe("useSlotActions", () => {
	it("lists the attached actions without `run`, and nothing when no source matches", () => {
		const { result } = renderHook(() => useSlotActions(options()), { wrapper: wrap([() => [action()]]) });
		expect(result.current.actions).toEqual([{ id: "suggest", label: "Suggest", apply: "replace" }]);
		expect(result.current.state).toEqual({ status: "idle" });
		const empty = renderHook(() => useSlotActions(options()), { wrapper: wrap([() => []]) });
		expect(empty.result.current.actions).toEqual([]);
	});

	it("PLUG-A3 runs with the context read at run time and puts the first candidate in at once", async () => {
		const run = vi.fn(action().run);
		const opts = options();
		const { result } = renderHook(() => useSlotActions(opts), { wrapper: wrap([() => [action({ run })]]) });
		let outcome: EditorResult<SlotResult> | undefined;
		await act(async () => {
			outcome = await result.current.run("suggest");
		});
		expect(run).toHaveBeenCalledWith({ title: "Hello" }, expect.any(AbortSignal));
		expect(outcome).toEqual({ ok: true, value: candidates("alpha", "beta") });
		expect(opts.apply).toHaveBeenCalledTimes(1);
		expect(opts.apply).toHaveBeenCalledWith("alpha", "replace");
		expect(result.current.state).toEqual({ status: "idle" });
	});

	it("PLUG-A3 an `append` action adds every candidate, and a text result is put in as it is", async () => {
		const opts = options();
		const append = renderHook(() => useSlotActions(opts), {
			wrapper: wrap([() => [action({ apply: "append", run: async () => candidates("a", "b", "c") })]]),
		});
		await act(async () => {
			await append.result.current.run("suggest");
		});
		expect(opts.apply).toHaveBeenCalledTimes(3);
		for (const [nth, value] of [
			[1, "a"],
			[2, "b"],
			[3, "c"],
		] as const)
			expect(opts.apply).toHaveBeenNthCalledWith(nth, value, "append");

		const text = options();
		const written = renderHook(() => useSlotActions(text), {
			wrapper: wrap([() => [action({ run: async () => ({ kind: "text", text: "One line." }) })]]),
		});
		await act(async () => {
			await written.result.current.run("suggest");
		});
		expect(text.apply).toHaveBeenCalledWith("One line.", "replace");
	});

	it("PLUG-A3 a result with nothing for a field is a failure, not a silent write", async () => {
		const opts = options();
		const { result } = renderHook(() => useSlotActions(opts), {
			wrapper: wrap([() => [action({ run: async () => ({ kind: "note", text: "Only a note." }) })]]),
		});
		await act(async () => {
			await result.current.run("suggest");
		});
		expect(opts.apply).not.toHaveBeenCalled();
		expect(result.current.state).toMatchObject({ status: "error", error: { code: "invalid_state" } });
		act(() => result.current.cancel());
		expect(result.current.state).toEqual({ status: "idle" });
	});

	it("PLUG-A3 is running while the request is out, then idle; cancelling aborts the signal and never applies", async () => {
		const pending = deferred();
		const opts = options();
		const { result } = renderHook(() => useSlotActions(opts), {
			wrapper: wrap([() => [action({ run: pending.run })]]),
		});
		let outcome: Promise<EditorResult<SlotResult>> | undefined;
		act(() => {
			outcome = result.current.run("suggest");
		});
		expect(result.current.state).toMatchObject({ status: "running" });
		expect(result.current.disabled).toBe(true);
		act(() => result.current.cancel());
		expect(pending.signal()?.aborted).toBe(true);
		expect(result.current.state).toEqual({ status: "idle" });
		await act(async () => pending.resolve(candidates("late")));
		expect(await outcome).toMatchObject({ ok: false, error: { code: "aborted" } });
		expect(opts.apply).not.toHaveBeenCalled();
	});

	it("a failure lands in the state with the notice's words", async () => {
		const { result } = renderHook(() => useSlotActions(options()), {
			wrapper: wrap([
				() => [
					action({
						run: async () => {
							throw new NoticeError("No connection is ready.", "Save one on the AI screen.");
						},
					}),
				],
			]),
		});
		await act(async () => {
			await result.current.run("suggest");
		});
		expect(result.current.state).toMatchObject({
			status: "error",
			error: { message: "No connection is ready. Save one on the AI screen." },
		});
	});

	it("`disabled` follows the option", () => {
		const { result, rerender } = renderHook(({ disabled }) => useSlotActions(options({ disabled })), {
			initialProps: { disabled: true },
			wrapper: wrap([() => [action()]]),
		});
		expect(result.current.disabled).toBe(true);
		rerender({ disabled: false });
		expect(result.current.disabled).toBe(false);
	});

	it("commands keep their identity across renders, so they are safe in effects", async () => {
		const { result, rerender } = renderHook(() => useSlotActions(options()), { wrapper: wrap([() => [action()]]) });
		const before = result.current;
		await act(async () => {
			await result.current.run("suggest");
		});
		rerender();
		for (const command of ["run", "cancel"] as const) expect(result.current[command]).toBe(before[command]);
	});
});

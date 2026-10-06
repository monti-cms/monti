import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	type EditorResult,
	type SlotAction,
	type SlotActionsOptions,
	type SlotResult,
	type SlotSource,
	useSlotActions,
} from "../../hooks/public";
import { SlotRegistryProvider } from "../registry";

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
	({ children }: { children: ReactNode }) => <SlotRegistryProvider sources={sources}>{children}</SlotRegistryProvider>;

/** A control deferred by the test: resolves or rejects the run, and records the signal the run received. */
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
	it("lists the attached actions as views without `run`, and nothing when no source matches", () => {
		const { result } = renderHook(() => useSlotActions(options()), { wrapper: wrap([() => [action()]]) });
		expect(result.current.actions.map((a) => a.id)).toEqual(["suggest"]);
		expect("run" in (result.current.actions[0] ?? {})).toBe(false);
		expect(result.current.state).toEqual({ status: "idle" });

		const empty = renderHook(() => useSlotActions(options()), { wrapper: wrap([() => []]) });
		expect(empty.result.current.actions).toEqual([]);
	});

	it("runs with the context read at run time, keeps the result, and applies a candidate only on apply()", async () => {
		const run = vi.fn(action().run);
		const opts = options();
		const { result } = renderHook(() => useSlotActions(opts), { wrapper: wrap([() => [action({ run })]]) });

		let outcome: EditorResult<SlotResult> | undefined;
		await act(async () => {
			outcome = await result.current.run("suggest");
		});
		expect(run.mock.calls[0]?.[0]).toEqual({ title: "Hello" });
		expect(outcome).toEqual({ ok: true, value: candidates("alpha", "beta") });
		expect(result.current.state).toMatchObject({ status: "done", result: candidates("alpha", "beta") });
		expect(opts.apply).not.toHaveBeenCalled();

		expect(result.current.apply("beta")).toEqual({ ok: true, value: undefined });
		expect(opts.apply).toHaveBeenCalledWith("beta", "replace");
		// The same candidate can be applied again.
		result.current.apply("beta");
		expect(opts.apply).toHaveBeenCalledTimes(2);
	});

	it("start() runs an action, and asks for the instruction first when the action takes one", async () => {
		const run = vi.fn(action().run);
		const { result } = renderHook(() => useSlotActions(options()), {
			wrapper: wrap([() => [action({ run, askInstruction: true })]]),
		});

		act(() => result.current.start("suggest"));
		expect(result.current.state).toMatchObject({ status: "asking", action: { id: "suggest" } });
		expect(run).not.toHaveBeenCalled();

		act(() => result.current.setInstruction("  only short ones "));
		await act(async () => {
			await result.current.run("suggest");
		});
		expect(run.mock.calls[0]?.[0]).toEqual({ title: "Hello", request: "only short ones" });
		// The instruction stays for the next run.
		expect(result.current.instruction).toBe("  only short ones ");

		await act(async () => {
			await result.current.run("suggest", { instruction: "other" });
		});
		expect(run.mock.calls[1]?.[0]).toEqual({ title: "Hello", request: "other" });
	});

	it("cancel() aborts the running request, goes back to idle and never lands in the error state", async () => {
		const pending = deferred();
		const { result } = renderHook(() => useSlotActions(options()), {
			wrapper: wrap([() => [action({ run: pending.run })]]),
		});

		let outcome: Promise<EditorResult<SlotResult>> | undefined;
		act(() => {
			outcome = result.current.run("suggest");
		});
		expect(result.current.state.status).toBe("running");
		expect(result.current.disabled).toBe(true);
		expect(pending.signal()?.aborted).toBe(false);

		act(() => result.current.cancel());
		expect(pending.signal()?.aborted).toBe(true);
		expect(result.current.state).toEqual({ status: "idle" });
		expect(result.current.disabled).toBe(false);

		// The provider's late rejection must not turn into an error state.
		pending.reject(new Error("aborted"));
		const settled = await outcome;
		expect(settled).toMatchObject({ ok: false, error: { code: "aborted" } });
		expect(result.current.state).toEqual({ status: "idle" });
	});

	it("a new run aborts the previous run of the same slot, and only the new one reaches the state", async () => {
		const first = deferred();
		const second = deferred();
		const runs = [first.run, second.run];
		const { result } = renderHook(() => useSlotActions(options()), {
			wrapper: wrap([() => [action({ run: (context, signal) => (runs.shift() ?? first.run)(context, signal) })]]),
		});

		let firstOutcome: Promise<EditorResult<SlotResult>> | undefined;
		act(() => {
			firstOutcome = result.current.run("suggest");
		});
		act(() => {
			void result.current.run("suggest");
		});
		expect(first.signal()?.aborted).toBe(true);
		expect(second.signal()?.aborted).toBe(false);

		first.resolve(candidates("stale"));
		expect(await firstOutcome).toMatchObject({ ok: false, error: { code: "aborted" } });
		expect(result.current.state.status).toBe("running");

		await act(async () => second.resolve(candidates("fresh")));
		expect(result.current.state).toMatchObject({ status: "done", result: candidates("fresh") });
	});

	it("apply() fails with invalid_state without a done result, for a display-only action, and after cancel", async () => {
		const opts = options();
		const { result } = renderHook(() => useSlotActions(opts), {
			wrapper: wrap([
				() => [action(), action({ id: "note", apply: "none", run: async () => ({ kind: "note", text: "FYI" }) })],
			]),
		});

		expect(result.current.apply("x")).toMatchObject({ ok: false, error: { code: "invalid_state" } });

		await act(async () => {
			await result.current.run("note");
		});
		expect(result.current.state.status).toBe("done");
		expect(result.current.apply("FYI")).toMatchObject({ ok: false, error: { code: "invalid_state" } });

		await act(async () => {
			await result.current.run("suggest");
		});
		act(() => result.current.cancel());
		expect(result.current.apply("alpha")).toMatchObject({ ok: false, error: { code: "invalid_state" } });
		expect(opts.apply).not.toHaveBeenCalled();
	});

	it("a failed run lands in the error state with an EditorError, resolves with it, and rerun() tries again", async () => {
		let attempts = 0;
		const run = vi.fn<SlotAction["run"]>(async () => {
			attempts += 1;
			if (attempts === 1) throw new Error("The AI service is down.");
			return candidates("ok");
		});
		const { result } = renderHook(() => useSlotActions(options()), { wrapper: wrap([() => [action({ run })]]) });

		let outcome: EditorResult<SlotResult> | undefined;
		await act(async () => {
			outcome = await result.current.run("suggest");
		});
		expect(outcome).toMatchObject({ ok: false, error: { code: "failed", message: "The AI service is down." } });
		expect(result.current.state).toMatchObject({
			status: "error",
			action: { id: "suggest" },
			error: { code: "failed", message: "The AI service is down." },
		});

		await act(async () => {
			await result.current.rerun();
		});
		expect(result.current.state).toMatchObject({ status: "done", result: candidates("ok") });
	});

	it("rerun() fails with invalid_state while idle, and run() with an unknown action id", async () => {
		const { result } = renderHook(() => useSlotActions(options()), { wrapper: wrap([() => [action()]]) });
		expect(await result.current.rerun()).toMatchObject({ ok: false, error: { code: "invalid_state" } });
		expect(await result.current.run("nope")).toMatchObject({ ok: false, error: { code: "invalid_state" } });
		expect(result.current.state).toEqual({ status: "idle" });
	});

	it("an instant action applies the first candidate and goes back to idle, without a result panel state", async () => {
		const opts = options();
		const { result } = renderHook(() => useSlotActions(opts), {
			wrapper: wrap([() => [action({ instant: true, apply: "append" })]]),
		});
		await act(async () => {
			await result.current.run("suggest");
		});
		expect(opts.apply).toHaveBeenCalledWith("alpha", "append");
		expect(result.current.state).toEqual({ status: "idle" });
	});

	it("an instant action with nothing to insert shows a done state and applies nothing", async () => {
		const opts = options();
		const { result } = renderHook(() => useSlotActions(opts), {
			wrapper: wrap([() => [action({ instant: true, run: async () => candidates() })]]),
		});
		await act(async () => {
			await result.current.run("suggest");
		});
		expect(opts.apply).not.toHaveBeenCalled();
		expect(result.current.state.status).toBe("done");
	});

	it("`disabled` follows the option and is also true while running", () => {
		const { result, rerender } = renderHook(({ disabled }) => useSlotActions(options({ disabled })), {
			initialProps: { disabled: true },
			wrapper: wrap([() => [action()]]),
		});
		expect(result.current.disabled).toBe(true);
		rerender({ disabled: false });
		expect(result.current.disabled).toBe(false);
	});

	it("two hook instances with the same slot, target, collection and scope share one run state", async () => {
		const pending = deferred();
		const sources = [() => [action({ run: pending.run })]];
		const { result } = renderHook(
			() => ({ a: useSlotActions(options({ scope: "e1" })), b: useSlotActions(options({ scope: "e1" })) }),
			{ wrapper: wrap(sources) },
		);

		act(() => {
			void result.current.a.run("suggest");
		});
		expect(result.current.b.state.status).toBe("running");
		expect(result.current.b.disabled).toBe(true);

		await act(async () => pending.resolve(candidates("shared")));
		expect(result.current.b.state).toMatchObject({ status: "done", result: candidates("shared") });

		act(() => result.current.b.cancel());
		expect(result.current.a.state).toEqual({ status: "idle" });
	});

	it("a different scope keeps a separate run state", async () => {
		const { result } = renderHook(
			() => ({ a: useSlotActions(options({ scope: "e1" })), b: useSlotActions(options({ scope: "e2" })) }),
			{ wrapper: wrap([() => [action()]]) },
		);
		await act(async () => {
			await result.current.a.run("suggest");
		});
		expect(result.current.a.state.status).toBe("done");
		expect(result.current.b.state.status).toBe("idle");
	});

	it("the run keeps going when the component unmounts, and the result is there when it mounts again", async () => {
		const pending = deferred();
		const sources: SlotSource[] = [() => [action({ run: pending.run })]];
		const request = options({ scope: "image-1" });
		function Panel() {
			const slot = useSlotActions(request);
			return (
				<button type="button" onClick={() => slot.start("suggest")}>
					{slot.state.status}
				</button>
			);
		}
		const view = (shown: boolean) => (
			<SlotRegistryProvider sources={sources}>{shown && <Panel />}</SlotRegistryProvider>
		);
		const { rerender } = render(view(true));
		fireEvent.click(screen.getByRole("button", { name: "idle" }));
		await screen.findByRole("button", { name: "running" });
		rerender(view(false));
		expect(pending.signal()?.aborted).toBe(false);

		await act(async () => pending.resolve(candidates("kept")));
		rerender(view(true));
		expect(screen.getByRole("button", { name: "done" })).toBeTruthy();
	});

	it("commands keep their identity across renders, so they are safe in effects", async () => {
		const { result, rerender } = renderHook(() => useSlotActions(options()), { wrapper: wrap([() => [action()]]) });
		const before = result.current;
		await act(async () => {
			await result.current.run("suggest");
		});
		rerender();
		for (const command of ["start", "run", "rerun", "cancel", "apply", "setInstruction"] as const) {
			expect(result.current[command]).toBe(before[command]);
		}
	});

	it("a custom slot UI built only on the hook: trigger, cancel while running, candidates, apply", async () => {
		const pending = deferred();
		const apply = vi.fn();
		function CustomSlot() {
			const slot = useSlotActions({ slot: "field", target: "title", getContext: () => ({}), apply });
			if (slot.actions.length === 0) return null;
			const { state } = slot;
			return (
				<div>
					{slot.actions.map((a) => (
						<button key={a.id} type="button" disabled={slot.disabled} onClick={() => slot.start(a.id)}>
							{a.label}
						</button>
					))}
					{state.status === "running" && (
						<button type="button" onClick={slot.cancel}>
							Stop
						</button>
					)}
					{state.status === "error" && <p role="alert">{state.error.message}</p>}
					{state.status === "done" &&
						state.result.kind === "candidates" &&
						state.result.items.map((item) => (
							<button key={item.value} type="button" onClick={() => slot.apply(item.value)}>
								use {item.label}
							</button>
						))}
				</div>
			);
		}
		render(
			<SlotRegistryProvider sources={[() => [action({ run: pending.run })]]}>
				<CustomSlot />
			</SlotRegistryProvider>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Suggest" }));
		await waitFor(() =>
			expect((screen.getByRole("button", { name: "Suggest" }) as HTMLButtonElement).disabled).toBe(true),
		);
		fireEvent.click(screen.getByRole("button", { name: "Stop" }));
		expect(pending.signal()?.aborted).toBe(true);
		expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "Suggest" }));
		await act(async () => pending.resolve(candidates("alpha")));
		fireEvent.click(await screen.findByRole("button", { name: "use alpha" }));
		expect(apply).toHaveBeenCalledWith("alpha", "replace");
	});
});

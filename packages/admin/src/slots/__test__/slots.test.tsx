import { createTranslator } from "@monti-cms/core/client";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "../../ui/tooltip";
import { slotsMessages } from "../messages";
import { type SlotAction, SlotRegistryProvider, type SlotRequest, type SlotSource, useSlot } from "../slots";

const t = createTranslator(slotsMessages);

afterEach(cleanup);

function Host({ request }: { request: SlotRequest }) {
	const { trigger, panel } = useSlot(request);
	return (
		<div>
			<span data-testid="trigger">{trigger}</span>
			{panel}
		</div>
	);
}

const action = (overrides: Partial<SlotAction> = {}): SlotAction => ({
	id: "a1",
	label: "주소 추천",
	apply: "replace",
	run: async () => ({ kind: "candidates", items: [{ value: "react-query", label: "react-query" }] }),
	...overrides,
});

function renderSlot(sources: SlotSource[], request: Partial<SlotRequest> = {}) {
	const apply = vi.fn();
	const getContext = vi.fn(() => ({ title: "제목" }));
	render(
		<TooltipProvider>
			<SlotRegistryProvider sources={sources}>
				<Host request={{ slot: "field", target: "slug", collection: "post", getContext, apply, ...request }} />
			</SlotRegistryProvider>
		</TooltipProvider>,
	);
	return { apply, getContext };
}

describe("screen slots", () => {
	it("renders nothing when no action is attached", () => {
		renderSlot([() => []]);
		expect(screen.getByTestId("trigger").childElementCount).toBe(0);
	});

	it("the source picks actions by slot name, target and collection", () => {
		const source = vi.fn<SlotSource>(() => []);
		renderSlot([source]);
		expect(source).toHaveBeenCalledWith({ slot: "field", target: "slug", collection: "post" });
	});

	it("runs with the current context on click, and the value changes only when a candidate is clicked", async () => {
		const run = vi.fn(action().run);
		const { apply, getContext } = renderSlot([() => [action({ run })]]);

		fireEvent.click(screen.getByRole("button", { name: "주소 추천" }));
		const chip = await screen.findByRole("button", { name: "react-query" });
		expect(getContext).toHaveBeenCalledTimes(1);
		expect(run.mock.calls[0]?.[0]).toEqual({ title: "제목" });
		expect(apply).not.toHaveBeenCalled();

		fireEvent.click(chip);
		expect(apply).toHaveBeenCalledWith("react-query", "replace");
		// It can be clicked again after inserting (clear, then insert again).
		expect((chip as HTMLButtonElement).disabled).toBe(false);
		fireEvent.click(chip);
		expect(apply).toHaveBeenCalledTimes(2);
	});

	it("while generating, does not open the result panel and only disables the button", async () => {
		let finish: (value: { kind: "text"; text: string }) => void = () => {};
		const run = vi.fn(
			() =>
				new Promise<{ kind: "text"; text: string }>((resolve) => {
					finish = resolve;
				}),
		);
		renderSlot([() => [action({ run })]]);
		const button = screen.getByRole("button", { name: "주소 추천" }) as HTMLButtonElement;
		fireEvent.click(button);
		await waitFor(() => expect(button.disabled).toBe(true));
		expect(screen.queryByRole("button", { name: t("close") })).toBeNull();
		finish({ kind: "text", text: "결과" });
		expect(await screen.findByText("결과")).toBeTruthy();
	});

	it("an insert-immediately action inserts the first candidate without opening the result panel, and notifies when there is nothing to insert", async () => {
		const run = vi.fn(async () => ({
			kind: "candidates" as const,
			items: [
				{ value: "first", label: "first" },
				{ value: "second", label: "second" },
			],
		}));
		const { apply } = renderSlot([() => [action({ run, instant: true })]]);
		fireEvent.click(screen.getByRole("button", { name: "주소 추천" }));
		await waitFor(() => expect(apply).toHaveBeenCalledWith("first", "replace"));
		expect(screen.queryByRole("button", { name: "second" })).toBeNull();

		cleanup();
		const empty = renderSlot([() => [action({ instant: true, run: async () => ({ kind: "candidates", items: [] }) })]]);
		fireEvent.click(screen.getByRole("button", { name: "주소 추천" }));
		expect(await screen.findByText(t("noResults"))).toBeTruthy();
		expect(empty.apply).not.toHaveBeenCalled();
	});

	it("an action that takes a request opens the input first and sends the typed request along when run", async () => {
		const run = vi.fn(action().run);
		renderSlot([() => [action({ run, askInstruction: true })]]);

		fireEvent.click(screen.getByRole("button", { name: "주소 추천" }));
		expect(run).not.toHaveBeenCalled();
		const input = screen.getByRole("textbox", { name: t("instruction") });
		fireEvent.change(input, { target: { value: "  tailwind 클래스만 " } });
		// Enter inserts a newline; run with Cmd/Ctrl+Enter.
		fireEvent.keyDown(input, { key: "Enter" });
		expect(run).not.toHaveBeenCalled();
		fireEvent.keyDown(input, { key: "Enter", metaKey: true });

		await screen.findByRole("button", { name: "react-query" });
		expect(run.mock.calls[0]?.[0]).toEqual({ title: "제목", request: "tailwind 클래스만" });
		// The request remains after viewing the result, so it can be run again.
		expect((screen.getByRole("textbox", { name: t("instruction") }) as HTMLInputElement).value).toBe(
			"  tailwind 클래스만 ",
		);
	});

	it("on failure, shows the reason and leaves the value as is", async () => {
		const { apply } = renderSlot([
			() => [
				action({
					run: async () => {
						throw new Error("AI 서비스에 문제가 있습니다.");
					},
				}),
			],
		]);
		fireEvent.click(screen.getByRole("button", { name: "주소 추천" }));
		expect((await screen.findByRole("alert")).textContent).toContain("AI 서비스에 문제가 있습니다.");
		expect(apply).not.toHaveBeenCalled();
	});

	it("a long-text result is inserted with the replace button, and a note has no insert button", async () => {
		const { apply } = renderSlot([() => [action({ run: async () => ({ kind: "text", text: "요약 글" }) })]]);
		fireEvent.click(screen.getByRole("button", { name: "주소 추천" }));
		fireEvent.click(await screen.findByRole("button", { name: t("replace") }));
		expect(apply).toHaveBeenCalledWith("요약 글", "replace");

		cleanup();
		renderSlot([() => [action({ apply: "none", run: async () => ({ kind: "note", text: "메모" }) })]]);
		fireEvent.click(screen.getByRole("button", { name: "주소 추천" }));
		await waitFor(() => expect(screen.getByText("메모")).toBeTruthy());
		expect(screen.queryByRole("button", { name: t("replace") })).toBeNull();
	});

	it("the request keeps going if the slot disappears while generating, and the result is still there after re-rendering", async () => {
		let finish: (value: { kind: "candidates"; items: { value: string; label: string }[] }) => void = () => {};
		const run = vi.fn<SlotAction["run"]>(
			(_context, signal) =>
				new Promise((resolve, reject) => {
					finish = resolve;
					signal.addEventListener("abort", () => reject(new Error("aborted")));
				}),
		);
		const sources: SlotSource[] = [() => [action({ run })]];
		const request: SlotRequest = {
			slot: "image",
			target: "alt",
			scope: "image-1",
			getContext: () => ({}),
			apply: vi.fn(),
		};
		const view = (shown: boolean) => (
			<TooltipProvider>
				<SlotRegistryProvider sources={sources}>{shown && <Host request={request} />}</SlotRegistryProvider>
			</TooltipProvider>
		);
		const { rerender } = render(view(true));
		fireEvent.click(screen.getByRole("button", { name: "주소 추천" }));
		rerender(view(false));
		expect(run.mock.calls[0]?.[1].aborted).toBe(false);

		finish({ kind: "candidates", items: [{ value: "설정 화면", label: "설정 화면" }] });
		rerender(view(true));
		expect(await screen.findByRole("button", { name: "설정 화면" })).toBeTruthy();
	});

	it("the same slot keeps separate results when the scope differs", async () => {
		const sources: SlotSource[] = [() => [action()]];
		const host = (scope: string) => (
			<Host request={{ slot: "image", target: "alt", scope, getContext: () => ({}), apply: vi.fn() }} />
		);
		render(
			<TooltipProvider>
				<SlotRegistryProvider sources={sources}>
					<div data-testid="a">{host("a")}</div>
					<div data-testid="b">{host("b")}</div>
				</SlotRegistryProvider>
			</TooltipProvider>,
		);
		fireEvent.click(screen.getAllByRole("button", { name: "주소 추천" })[0] as HTMLElement);
		await screen.findByRole("button", { name: "react-query" });
		expect(screen.getByTestId("b").textContent).not.toContain("react-query");
	});

	it("slot names are open: actions also attach to a slot with an extension-defined name", async () => {
		const source = vi.fn<SlotSource>(({ slot }) => (slot === "my-plugin/toolbar" ? [action()] : []));
		const { apply } = renderSlot([source], { slot: "my-plugin/toolbar", target: "export", collection: undefined });
		expect(source).toHaveBeenCalledWith({ slot: "my-plugin/toolbar", target: "export", collection: undefined });
		fireEvent.click(screen.getByRole("button", { name: "주소 추천" }));
		fireEvent.click(await screen.findByRole("button", { name: "react-query" }));
		expect(apply).toHaveBeenCalledWith("react-query", "replace");

		cleanup();
		renderSlot([source], { slot: "other", target: "export" });
		expect(screen.getByTestId("trigger").childElementCount).toBe(0);
	});

	it("uses the action's icon for the button, the result panel header and the run button, and a non-AI default icon when none is given", async () => {
		const icon = <svg data-testid="own-icon" aria-hidden />;
		renderSlot([() => [action({ icon, askInstruction: true })]]);
		expect(within(screen.getByTestId("trigger")).getByTestId("own-icon")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "주소 추천" }));
		// Result panel with the request input open: the header and the run button share the same icon.
		await screen.findByRole("textbox", { name: t("instruction") });
		expect(screen.getAllByTestId("own-icon").length).toBe(3);
		expect(document.querySelector(".lucide-sparkles")).toBeNull();

		cleanup();
		renderSlot([() => [action()]]);
		expect(screen.getByTestId("trigger").querySelector("svg.lucide-zap")).toBeTruthy();
		expect(document.querySelector(".lucide-sparkles")).toBeNull();
	});

	it("multiple actions are grouped into a menu; the action decides the menu name and icon, and each item uses its own icon", async () => {
		const first = action({
			id: "a1",
			label: "주소 추천",
			icon: <svg data-testid="icon-a1" aria-hidden />,
			menuLabel: "도우미",
			menuIcon: <svg data-testid="menu-icon" aria-hidden />,
		});
		const second = action({ id: "a2", label: "요약 쓰기", icon: <svg data-testid="icon-a2" aria-hidden /> });
		renderSlot([() => [first, second]]);
		const menu = screen.getByRole("button", { name: "도우미" });
		expect(within(menu).getByTestId("menu-icon")).toBeTruthy();
		fireEvent.click(menu);
		const item = await screen.findByRole("menuitem", { name: "요약 쓰기" });
		expect(within(item).getByTestId("icon-a2")).toBeTruthy();
		expect(within(await screen.findByRole("menuitem", { name: "주소 추천" })).getByTestId("icon-a1")).toBeTruthy();

		// Without a menu name, it is the first action's name.
		cleanup();
		renderSlot([() => [action({ id: "b1", label: "주소 추천" }), action({ id: "b2", label: "요약 쓰기" })]]);
		expect(screen.getByRole("button", { name: "주소 추천" })).toBeTruthy();
	});
});

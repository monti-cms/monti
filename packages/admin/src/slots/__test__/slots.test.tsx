import { createTranslator } from "@monti-cms/core/client";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "../../ui/tooltip";
import { slotsMessages } from "../messages";
import {
	CORE_SLOT_NAMES,
	type SlotAction,
	SlotRegistryProvider,
	type SlotRequest,
	type SlotSource,
	useSlot,
} from "../slots";

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

describe("화면 자리", () => {
	it("연결된 동작이 없으면 아무것도 그리지 않는다", () => {
		renderSlot([() => []]);
		expect(screen.getByTestId("trigger").childElementCount).toBe(0);
	});

	it("공급원은 자리 이름·대상·컬렉션을 보고 동작을 고른다", () => {
		const source = vi.fn<SlotSource>(() => []);
		renderSlot([source]);
		expect(source).toHaveBeenCalledWith({ slot: "field", target: "slug", collection: "post" });
	});

	it("누르면 지금 상황으로 실행하고, 후보를 눌러야 값을 바꾼다", async () => {
		const run = vi.fn(action().run);
		const { apply, getContext } = renderSlot([() => [action({ run })]]);

		fireEvent.click(screen.getByRole("button", { name: "주소 추천" }));
		const chip = await screen.findByRole("button", { name: "react-query" });
		expect(getContext).toHaveBeenCalledTimes(1);
		expect(run.mock.calls[0]?.[0]).toEqual({ title: "제목" });
		expect(apply).not.toHaveBeenCalled();

		fireEvent.click(chip);
		expect(apply).toHaveBeenCalledWith("react-query", "replace");
		// 넣은 뒤에도 다시 누를 수 있다(지웠다가 다시 넣기).
		expect((chip as HTMLButtonElement).disabled).toBe(false);
		fireEvent.click(chip);
		expect(apply).toHaveBeenCalledTimes(2);
	});

	it("만드는 동안은 결과 칸을 열지 않고 버튼만 막는다", async () => {
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

	it("바로 넣는 동작은 맨 앞 후보를 바로 넣고 결과 칸을 열지 않는다. 넣을 것이 없으면 알린다", async () => {
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

	it("요청을 받는 동작은 입력을 먼저 열고, 적은 요청을 실행할 때 함께 보낸다", async () => {
		const run = vi.fn(action().run);
		renderSlot([() => [action({ run, askInstruction: true })]]);

		fireEvent.click(screen.getByRole("button", { name: "주소 추천" }));
		expect(run).not.toHaveBeenCalled();
		const input = screen.getByRole("textbox", { name: t("instruction") });
		fireEvent.change(input, { target: { value: "  tailwind 클래스만 " } });
		// Enter는 줄바꿈이고 Cmd/Ctrl+Enter로 실행한다.
		fireEvent.keyDown(input, { key: "Enter" });
		expect(run).not.toHaveBeenCalled();
		fireEvent.keyDown(input, { key: "Enter", metaKey: true });

		await screen.findByRole("button", { name: "react-query" });
		expect(run.mock.calls[0]?.[0]).toEqual({ title: "제목", request: "tailwind 클래스만" });
		// 결과를 본 뒤에도 요청은 남아 다시 실행할 수 있다.
		expect((screen.getByRole("textbox", { name: t("instruction") }) as HTMLInputElement).value).toBe(
			"  tailwind 클래스만 ",
		);
	});

	it("실패하면 이유를 보여 주고 값은 그대로 둔다", async () => {
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

	it("긴 글 결과는 바꾸기 버튼으로 넣고, 메모는 넣는 버튼이 없다", async () => {
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

	it("만드는 중에 자리가 사라져도 요청을 멈추지 않고, 다시 그리면 결과가 남아 있다", async () => {
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

	it("같은 자리라도 구분값이 다르면 결과를 따로 둔다", async () => {
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

	it("자리 이름은 열려 있다: 확장이 정한 이름의 자리에도 동작이 붙는다", async () => {
		const source = vi.fn<SlotSource>(({ slot }) => (slot === "my-plugin/toolbar" ? [action()] : []));
		const { apply } = renderSlot([source], { slot: "my-plugin/toolbar", target: "export", collection: undefined });
		expect(source).toHaveBeenCalledWith({ slot: "my-plugin/toolbar", target: "export", collection: undefined });
		fireEvent.click(screen.getByRole("button", { name: "주소 추천" }));
		fireEvent.click(await screen.findByRole("button", { name: "react-query" }));
		expect(apply).toHaveBeenCalledWith("react-query", "replace");
		expect([...CORE_SLOT_NAMES]).toEqual(["field", "image", "codeRules", "media", "translation"]);

		cleanup();
		renderSlot([source], { slot: "other", target: "export" });
		expect(screen.getByTestId("trigger").childElementCount).toBe(0);
	});

	it("동작이 준 아이콘을 버튼·결과 칸 머리·실행 버튼에 쓰고, 없으면 AI가 아닌 기본 아이콘을 쓴다", async () => {
		const icon = <svg data-testid="own-icon" aria-hidden />;
		renderSlot([() => [action({ icon, askInstruction: true })]]);
		expect(within(screen.getByTestId("trigger")).getByTestId("own-icon")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "주소 추천" }));
		// 요청 입력이 열린 결과 칸: 머리와 실행 버튼에 같은 아이콘이다.
		await screen.findByRole("textbox", { name: t("instruction") });
		expect(screen.getAllByTestId("own-icon").length).toBe(3);
		expect(document.querySelector(".lucide-sparkles")).toBeNull();

		cleanup();
		renderSlot([() => [action()]]);
		expect(screen.getByTestId("trigger").querySelector("svg.lucide-zap")).toBeTruthy();
		expect(document.querySelector(".lucide-sparkles")).toBeNull();
	});

	it("동작이 여럿이면 메뉴로 묶고, 메뉴 이름·아이콘은 동작이 정하며 항목마다 제 아이콘을 쓴다", async () => {
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

		// 메뉴 이름을 주지 않으면 첫 동작의 이름이다.
		cleanup();
		renderSlot([() => [action({ id: "b1", label: "주소 추천" }), action({ id: "b2", label: "요약 쓰기" })]]);
		expect(screen.getByRole("button", { name: "주소 추천" })).toBeTruthy();
	});
});

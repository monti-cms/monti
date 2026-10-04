// @vitest-environment jsdom

import { useConfirm } from "@monti-cms/admin/kit";
import { createTranslator } from "@monti-cms/core/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedMessages as adminSharedMessages } from "../../../../admin/src/screens/shared/messages";
import type { AiSharedView } from "../../shared";
import { SharedManager } from "../shared-editor";
import { sharedMessages } from "../shared-editor.messages";

const t = createTranslator(sharedMessages);
const adminText = createTranslator(adminSharedMessages);

const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });

const VIEW: AiSharedView = {
	version: 2,
	items: [
		{
			source: "config",
			key: "styleGuide",
			label: "Style guide",
			defaultText: "default",
			text: "edited",
			overridden: true,
		},
		{ source: "added", key: "tone", label: "Tone", text: "polite" },
	],
};

let view: AiSharedView;
let fetchMock: ReturnType<typeof vi.fn>;
const calls = (method: string) => fetchMock.mock.calls.filter(([, init]) => init?.method === method);
const bodyOf = (call: unknown[] | undefined) => JSON.parse(String((call?.[1] as RequestInit).body));

beforeEach(() => {
	view = VIEW;
	fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
		if (input === "/api/cms/v1/ai/shared" && !init?.method) return json(view);
		if (input === "/api/cms/v1/ai/shared" && init?.method === "POST") {
			const body = JSON.parse(String(init.body));
			return json(
				{ version: 3, items: [...view.items, { source: "added", key: body.key, label: body.label, text: body.text }] },
				201,
			);
		}
		if (input === "/api/cms/v1/ai/shared" && init?.method === "PATCH") return json({ ...view, version: 3 });
		if (input.startsWith("/api/cms/v1/ai/shared?") && init?.method === "DELETE") {
			return json({ code: "ai_invalid_input", message: "Actions use this text, so it can't be deleted: Summary" }, 400);
		}
		throw new Error(`Unexpected fetch ${init?.method ?? "GET"} ${input}`);
	});
	vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

/** AI 화면처럼 연 문구를 들고, 저장하지 않은 내용이 있으면 묻는다. */
function Harness() {
	const [selected, setSelected] = useState<string | "new" | null>(null);
	const [dirty, setDirty] = useState(false);
	const { confirmDiscard, dialog } = useConfirm();
	return (
		<>
			<button type="button" onClick={async () => (await confirmDiscard(dirty)) && setSelected("new")}>
				add head
			</button>
			<SharedManager
				selected={selected}
				onOpen={async (key) => {
					if (key !== selected && (await confirmDiscard(dirty))) setSelected(key);
				}}
				onSelectedChange={setSelected}
				onDirtyChange={setDirty}
			/>
			{dialog}
		</>
	);
}

const renderManager = () =>
	render(
		<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
			<Harness />
		</QueryClientProvider>,
	);
const list = () => screen.getByRole("list", { name: t("list.label") });
const row = (name: string) => within(list()).getByRole("button", { name: new RegExp(name) });

describe("AI 화면 공통 문구 탭", () => {
	it("목록과 빈 상세를 보이고, 고른 문구를 열린 줄로 표시한다", async () => {
		renderManager();
		await screen.findByText(t("empty.title"));
		expect(
			within(list())
				.getAllByRole("button")
				.map((item) => item.textContent),
		).toEqual(["Style guide{{shared.styleGuide}}", `Tone{{shared.tone}} · ${t("detail.added")}`]);
		expect(screen.getByRole("button", { name: t("action.add") })).toBeTruthy();

		fireEvent.click(row("Style guide"));
		expect(await screen.findByRole("heading", { name: "Style guide" })).toBeTruthy();
		expect(row("Style guide").getAttribute("aria-current")).toBe("true");
		// 설정 문구: 이름은 설정이 정하고, 기본값으로 되돌릴 수 있으며 삭제는 없다.
		expect((screen.getByRole("textbox", { name: t("field.name") }) as HTMLInputElement).disabled).toBe(true);
		expect(screen.getByText("{{shared.styleGuide}}", { selector: "code" })).toBeTruthy();
		expect(screen.getByRole("button", { name: t("copy.label") })).toBeTruthy();
		expect(screen.queryByRole("button", { name: t("action.delete") })).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: t("action.resetDefault") }));
		expect((screen.getByRole("textbox", { name: t("field.content") }) as HTMLTextAreaElement).value).toBe("default");

		fireEvent.click(screen.getByRole("button", { name: t("action.save") }));
		await waitFor(() => expect(calls("PATCH")).toHaveLength(1));
		expect(bodyOf(calls("PATCH")[0])).toEqual({ expectedVersion: 2, key: "styleGuide", text: "default" });
	});

	it("저장하지 않은 내용이 있으면 다른 문구를 열기 전에 묻는다", async () => {
		renderManager();
		fireEvent.click(await screen.findByRole("button", { name: /Tone/ }));
		fireEvent.change(await screen.findByRole("textbox", { name: t("field.content") }), {
			target: { value: "changed" },
		});
		fireEvent.click(row("Style guide"));
		expect(await screen.findByRole("alertdialog", { name: adminText("discard.title") })).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: adminText("common.cancel") }));
		await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
		expect(screen.getByRole("heading", { name: "Tone" })).toBeTruthy();
	});

	it("새 문구는 키·이름·내용을 적어 저장하고, 저장한 문구를 연 채 둔다", async () => {
		renderManager();
		await screen.findByText(t("empty.title"));
		fireEvent.click(screen.getByRole("button", { name: t("action.add") }));
		const save = (await screen.findByRole("button", { name: t("action.save") })) as HTMLButtonElement;
		expect(save.disabled).toBe(true);
		fireEvent.change(screen.getByRole("textbox", { name: t("field.name") }), { target: { value: "Reader" } });
		fireEvent.change(screen.getByRole("textbox", { name: t("field.key") }), { target: { value: "reader" } });
		fireEvent.change(screen.getByRole("textbox", { name: t("field.content") }), { target: { value: "developer" } });
		fireEvent.click(save);
		await waitFor(() => expect(calls("POST")).toHaveLength(1));
		expect(bodyOf(calls("POST")[0])).toEqual({ expectedVersion: 2, key: "reader", label: "Reader", text: "developer" });
		await waitFor(() => expect(row("Reader").getAttribute("aria-current")).toBe("true"));
		expect(screen.getByText("{{shared.reader}}", { selector: "code" })).toBeTruthy();
	});

	it("더한 문구는 삭제를 묻고, 막히면 칸 안에 이유를 보인다", async () => {
		renderManager();
		fireEvent.click(await screen.findByRole("button", { name: /Tone/ }));
		expect(screen.queryByRole("button", { name: t("action.resetDefault") })).toBeNull();
		fireEvent.click(await screen.findByRole("button", { name: t("action.delete") }));
		const dialog = await screen.findByRole("alertdialog", { name: t("confirm.title") });
		fireEvent.click(within(dialog).getByRole("button", { name: t("action.delete") }));
		expect((await screen.findByRole("alert")).textContent).toBe(
			"Actions use this text, so it can't be deleted: Summary",
		);
		expect(calls("DELETE")[0]?.[0]).toBe("/api/cms/v1/ai/shared?key=tone&expectedVersion=2");
	});

	it("문구가 없으면 목록 자리에 한 줄로 알린다", async () => {
		view = { version: 0, items: [] };
		renderManager();
		expect(await screen.findByText(t("list.empty"))).toBeTruthy();
	});
});

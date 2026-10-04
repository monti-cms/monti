import { createTranslator } from "@monti-cms/core/client";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedMessages } from "../../shared/messages";
import { AdminQueryProvider } from "../../shared/query-provider";
import { templatesMessages } from "../messages";
import { TemplateManager } from "../template-manager";

const t = createTranslator(templatesMessages);
const tShared = createTranslator(sharedMessages);

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), message: vi.fn() }));
vi.mock("sonner", () => ({ Toaster: () => null, toast }));
vi.mock("../../../editor/tiptap-editor", () => ({ CmsEditor: () => null }));
vi.mock("../../admin-sidebar", () => ({ AdminSidebar: () => null }));

const template = (id: string, name: string, version = 1) => ({
	id,
	name,
	mdx: "## 개요",
	version,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
});
const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });

let fetchMock: ReturnType<typeof vi.fn>;
let listFails = false;

beforeEach(() => {
	vi.clearAllMocks();
	listFails = false;
	fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
		const method = init?.method ?? "GET";
		if (input === "/api/cms/v1/templates" && method === "GET")
			return listFails
				? json({ code: "internal", message: "서버 오류" }, 500)
				: json({ items: [template("a", "일반 게시글"), template("b", "메모")] });
		if (input === "/api/cms/v1/templates/a" && method === "PATCH") {
			const body = JSON.parse(String(init?.body));
			return json({ ...template("a", body.name, 2), mdx: body.mdx });
		}
		throw new Error(`Unexpected fetch ${method} ${input}`);
	});
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const renderManager = () =>
	render(
		<AdminQueryProvider>
			<TemplateManager />
		</AdminQueryProvider>,
	);

describe("TemplateManager", () => {
	it("loads templates from the API items envelope and shows the count beside the title", async () => {
		renderManager();

		expect(await screen.findByText("일반 게시글")).toBeTruthy();
		expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(`${t("title")}2`);
		expect(screen.queryByText("포스트용")).toBeNull();
	});

	it("marks the open template and saves without closing", async () => {
		renderManager();
		fireEvent.click(await screen.findByRole("button", { name: /^일반 게시글/ }));
		const name = await screen.findByRole("textbox", { name: t("edit.nameLabel") });
		expect(screen.getByRole("button", { name: /^일반 게시글/ }).getAttribute("aria-current")).toBe("true");

		fireEvent.change(name, { target: { value: "긴 글" } });
		fireEvent.click(screen.getByRole("button", { name: t("common.save") }));

		await waitFor(() => expect(toast.success).toHaveBeenCalledWith(t("common.saved")));
		expect((screen.getByRole("textbox", { name: t("edit.nameLabel") }) as HTMLInputElement).value).toBe("긴 글");
	});

	it("asks before discarding unsaved changes when opening another template", async () => {
		renderManager();
		fireEvent.click(await screen.findByRole("button", { name: /^일반 게시글/ }));
		fireEvent.change(await screen.findByRole("textbox", { name: t("edit.nameLabel") }), {
			target: { value: "바꾼 이름" },
		});

		fireEvent.click(screen.getByRole("button", { name: /^메모/ }));
		const dialog = await screen.findByRole("alertdialog", { name: tShared("discard.title") });
		fireEvent.click(within(dialog).getByRole("button", { name: tShared("discard.confirm") }));

		await waitFor(() =>
			expect((screen.getByRole("textbox", { name: t("edit.nameLabel") }) as HTMLInputElement).value).toBe("메모"),
		);
	});

	it("shows a retry button when the list fails to load", async () => {
		listFails = true;
		renderManager();
		// The list request is retried once before it is treated as a failure.
		const alert = await screen.findByRole("alert", undefined, { timeout: 3000 });
		expect(alert.textContent).toContain("서버 오류");
		listFails = false;
		fireEvent.click(within(alert).getByRole("button", { name: t("common.retry") }));
		expect(await screen.findByText("일반 게시글")).toBeTruthy();
	});
});

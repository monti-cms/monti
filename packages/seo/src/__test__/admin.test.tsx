import { EMPTY_FORM, type EntryForm, TooltipProvider } from "@monti-cms/admin/kit";
import { type SlotAction, SlotRegistryProvider } from "@monti-cms/admin/slots";
import { COLLECTIONS, type Collection, createTranslator, roleField, SITE_NAME, schemaOf } from "@monti-cms/core/client";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// 속성 칸은 공개 진입점이 아니라 관리자 패키지 소스에서 읽는다(테스트 전용).
import { InspectorPanel } from "../../../admin/src/screens/entries/inspector-panel";
import { SEO_ROLES } from "..";
import { SeoAdminProvider } from "../admin/provider";
import { seoMessages } from "../messages";

// 화면 문구는 설정의 관리자 언어를 따르므로 사전에서 같은 말을 고른다.
const t = createTranslator(seoMessages);

/**
 * SEO 확장의 관리자 화면(설정과 상관없이, M10-1 재발 방지). 컬렉션·필드·탭은 지금 설정에서 역할로 찾는다
 * (블로그 예시 설정은 `SEO` 탭의 `seoTitle`…, 다른 사이트 설정은 `Search` 탭의 `metaTitle`…).
 */

beforeEach(() => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ items: [], total: 0, publicUrl: null }) })),
	);
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const collection = COLLECTIONS.find((name) => roleField(name, SEO_ROLES.title)) as Collection;
const field = (role: string) => {
	const stored = roleField(collection, role);
	if (!stored) throw new Error(`no ${role} field`);
	return stored;
};
const summaryField = roleField(collection, "summary");
const tab = field(SEO_ROLES.title).field.tab ?? "";

function renderPanel(form: EntryForm, onChange = vi.fn(), sources: SlotAction[] = []) {
	render(
		<TooltipProvider>
			<SeoAdminProvider>
				<SlotRegistryProvider sources={[(request) => (request.target === field(SEO_ROLES.title).name ? sources : [])]}>
					<InspectorPanel
						collection={collection}
						form={form}
						disabled={false}
						entry={null}
						incomingReferences={[]}
						isLoadingIncomingReferences={false}
						onRefreshIncomingReferences={vi.fn()}
						onSlugChange={vi.fn()}
						onRegenerateSlug={vi.fn()}
						onChange={onChange}
						onClose={vi.fn()}
					/>
				</SlotRegistryProvider>
			</SeoAdminProvider>
		</TooltipProvider>,
	);
	fireEvent.click(screen.getByRole("tab", { name: tab }));
	return onChange;
}

describe("SEO 확장 관리자 화면", () => {
	it("SEO 필드는 배치를 적지 않아도 제 탭에 모인다", async () => {
		const title = field(SEO_ROLES.title);
		renderPanel({ ...EMPTY_FORM, title: "Entry title", [title.name]: "Search value" });
		expect(((await screen.findByLabelText(title.field.label)) as HTMLInputElement).value).toBe("Search value");
		expect(screen.getByLabelText(field(SEO_ROLES.description).field.label).tagName).toBe("TEXTAREA");
		// 공유 이미지는 미디어 필드라 미디어 고르기로 입력한다.
		expect(screen.getByLabelText(field(SEO_ROLES.image).field.label).textContent).toBeTruthy();
	});

	it("검색 미리보기는 역할 필드 값을 쓰고, 비면 제목·요약을 쓴다", async () => {
		renderPanel({
			...EMPTY_FORM,
			title: "Entry title",
			slug: "hello",
			...(summaryField ? { [summaryField.name]: "Lead" } : {}),
		});
		const search = await screen.findByRole("region", { name: t("preview.search") });
		expect(within(search).getByText("Entry title")).toBeTruthy();
		if (summaryField) expect(within(search).getByText("Lead")).toBeTruthy();
		expect(within(search).getByText(new RegExp(`${SITE_NAME}.*hello`))).toBeTruthy();
		expect(screen.getByRole("region", { name: t("preview.share") })).toBeTruthy();
	});

	it("비운 검색 제목·설명은 대신 쓸 값을 안내 문구와 글자 수로 보인다", async () => {
		const title = field(SEO_ROLES.title);
		renderPanel({ ...EMPTY_FORM, title: "Entry title", ...(summaryField ? { [summaryField.name]: "Lead" } : {}) });
		expect(((await screen.findByLabelText(title.field.label)) as HTMLInputElement).placeholder).toBe("Entry title");
		const limit = title.field.kind === "text" ? (title.field.max ?? title.field.inputOptions?.limit) : undefined;
		expect(screen.getByText(`11/${limit}`)).toBeTruthy();
		if (summaryField) {
			const description = screen.getByLabelText(field(SEO_ROLES.description).field.label) as HTMLTextAreaElement;
			expect(description.placeholder).toBe("Lead");
		}
	});

	it("숨기기는 이름표 줄의 스위치이고, 켜면 `noindex`다", async () => {
		const noindex = field(SEO_ROLES.noindex);
		const onChange = renderPanel({ ...EMPTY_FORM, title: "Entry" });
		fireEvent.click(await screen.findByRole("switch", { name: noindex.field.label }));
		expect(onChange).toHaveBeenCalledWith({ [noindex.name]: "noindex" });
	});

	it("검색 제목 옆 동작(AI 등)은 그대로 붙고 요약 역할 값을 `summary`로 받는다", async () => {
		const run = vi.fn<SlotAction["run"]>(async () => ({ kind: "text", text: "New" }));
		renderPanel({ ...EMPTY_FORM, title: "Entry", ...(summaryField ? { [summaryField.name]: "Lead" } : {}) }, vi.fn(), [
			{ id: "t", label: "Suggest", apply: "replace", run },
		]);
		fireEvent.click(await screen.findByRole("button", { name: "Suggest" }));
		await waitFor(() => expect(run).toHaveBeenCalled());
		expect(run.mock.calls[0]?.[0]).toMatchObject({ title: "Entry", ...(summaryField ? { summary: "Lead" } : {}) });
	});

	it("SEO 탭이 없는 컬렉션은 기본 탭 하나다", () => {
		const plain = COLLECTIONS.find((name) => Object.values(schemaOf(name).fields).every((item) => !item.tab));
		if (!plain) return;
		render(
			<TooltipProvider>
				<SeoAdminProvider>
					<InspectorPanel
						collection={plain}
						form={{ ...EMPTY_FORM, title: "Plain" }}
						disabled={false}
						entry={null}
						incomingReferences={[]}
						isLoadingIncomingReferences={false}
						onRefreshIncomingReferences={vi.fn()}
						onSlugChange={vi.fn()}
						onRegenerateSlug={vi.fn()}
						onChange={vi.fn()}
						onClose={vi.fn()}
					/>
				</SeoAdminProvider>
			</TooltipProvider>,
		);
		expect(screen.getAllByRole("tab")).toHaveLength(1);
	});
});

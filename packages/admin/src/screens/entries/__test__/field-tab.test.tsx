import { COLLECTIONS, type Collection, isCollection, schemaOf } from "@monti-cms/core/client";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CmsAdminComponentsProvider, type FieldViewProps } from "../../../admin-components";
import { TooltipProvider } from "../../../ui/tooltip";
import { EMPTY_FORM, type EntryForm } from "../entry-form";
import { InspectorPanel } from "../inspector-panel";
import { t } from "../translate";

/**
 * 필드 `tab`과 보기 필드(설정과 상관없이, M10-1 재발 방지). 컬렉션·필드·탭 이름은 지금 설정에서 찾는다
 * (블로그 예시 설정은 SEO 확장 필드가 `SEO` 탭, 다른 사이트 설정은 `Search` 탭이다).
 */

beforeEach(() => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ items: [], total: 0 }) })),
	);
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

/** 필드 `tab`을 가진 텍스트 필드가 있는 첫 컬렉션과 그 필드(등록하지 않은 `input`은 기본 입력으로 그린다). */
const found = (() => {
	for (const collection of COLLECTIONS) {
		for (const [name, field] of Object.entries(schemaOf(collection).fields)) {
			if (field.tab && field.kind === "text") return { collection, name, field };
		}
	}
	return undefined;
})();
const viewField = found
	? Object.entries(schemaOf(found.collection).fields).find(([, field]) => field.kind === "view" && field.tab)
	: undefined;

function renderPanel(collection: Collection, form: EntryForm, children?: (panel: React.ReactNode) => React.ReactNode) {
	const panel = (
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
			onChange={vi.fn()}
			onClose={vi.fn()}
		/>
	);
	render(<TooltipProvider>{children ? children(panel) : panel}</TooltipProvider>);
}

describe("속성 칸: 필드 `tab`", () => {
	it("설정에 `tab`을 가진 필드가 있다", () => {
		expect(found).toBeDefined();
	});

	it("필드 `tab`의 필드는 배치를 적지 않아도 그 탭에 그리고 기본 탭에는 그리지 않는다", async () => {
		if (!found || !isCollection(found.collection)) return;
		renderPanel(found.collection, { ...EMPTY_FORM, title: "Title", [found.name]: "Tab value" });
		expect(screen.queryByLabelText(found.field.label)).toBeNull();
		fireEvent.click(screen.getByRole("tab", { name: found.field.tab }));
		expect(((await screen.findByLabelText(found.field.label)) as HTMLInputElement).value).toBe("Tab value");
	});

	it("보기 필드는 등록한 화면(`fieldViews`)을 그 탭에 그리고, 등록이 없으면 아무것도 그리지 않는다", async () => {
		if (!found || !viewField || viewField[1].kind !== "view") return;
		const [, view] = viewField;
		const Custom = ({ form }: FieldViewProps) => <p>preview: {String(form.title)}</p>;
		renderPanel(found.collection, { ...EMPTY_FORM, title: "Title" }, (panel) => (
			<CmsAdminComponentsProvider components={{ fieldViews: { [view.view]: Custom } }}>
				{panel}
			</CmsAdminComponentsProvider>
		));
		fireEvent.click(screen.getByRole("tab", { name: view.tab }));
		expect(await screen.findByText("preview: Title")).toBeTruthy();
		cleanup();
		renderPanel(found.collection, { ...EMPTY_FORM, title: "Title" });
		fireEvent.click(screen.getByRole("tab", { name: view.tab }));
		expect(screen.queryByText("preview: Title")).toBeNull();
	});

	it("`tab`이 없는 컬렉션은 기본 탭 하나만 있다", () => {
		const plain = COLLECTIONS.find((collection) =>
			Object.values(schemaOf(collection).fields).every((field) => !field.tab),
		);
		if (!plain || (schemaOf(plain).layout ?? []).some((group) => group.tab)) return;
		renderPanel(plain, { ...EMPTY_FORM, title: "Plain" });
		expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([t("tab.default")]);
	});
});

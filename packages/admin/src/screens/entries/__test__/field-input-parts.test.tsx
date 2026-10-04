import { COLLECTIONS, storedFields } from "@monti-cms/core/client";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CmsAdminComponentsProvider, type FieldInputParts } from "../../../admin-components";
import { TooltipProvider } from "../../../ui/tooltip";
import { EMPTY_FORM, type EntryForm } from "../entry-form";
import { SchemaFields } from "../schema-fields";
import { t } from "../translate";

/**
 * 확장이 등록하는 입력 조각(`FieldInputParts`)과 미디어 필드의 기본 입력. 설정과 상관없이(M10-1) 지금 설정에서
 * `input`을 가진 텍스트·선택 필드와 미디어 필드를 찾는다(두 예시 설정 모두 SEO 확장 필드가 있다).
 */

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const find = (kind: string, withInput: boolean) => {
	for (const collection of COLLECTIONS) {
		const stored = storedFields(collection).find(
			({ field, when }) => !when && field.kind === kind && Boolean(field.input) === withInput,
		);
		if (stored) return { collection, ...stored };
	}
	return undefined;
};
const text = find("text", true);
const select = find("select", true);
const media = find("media", false);

function renderFields(
	target: { collection: (typeof COLLECTIONS)[number]; name: string },
	form: EntryForm,
	fieldInputs: Readonly<Record<string, FieldInputParts>> = {},
	onChange = vi.fn(),
) {
	render(
		<TooltipProvider>
			<CmsAdminComponentsProvider components={{ fieldInputs }}>
				<SchemaFields
					collection={target.collection}
					form={form}
					context={{ disabled: false }}
					onChange={onChange}
					include={(group) => group.fields.includes(target.name)}
				/>
			</CmsAdminComponentsProvider>
		</TooltipProvider>,
	);
	return onChange;
}

describe("입력 조각(`FieldInputParts`)", () => {
	it("기본 입력을 두고 안내 문구와 이름표 줄 오른쪽을 바꾼다. 조각은 다른 필드 값(`form`)을 읽는다", () => {
		if (!text?.field.input) return;
		renderFields(
			text,
			{ ...EMPTY_FORM, title: "Fallback title" },
			{
				[text.field.input]: {
					placeholder: ({ form }) => form.title,
					Aside: ({ value, form }) => <span>count {String(value || form.title).length}</span>,
				},
			},
		);
		expect((screen.getByLabelText(text.field.label) as HTMLInputElement).placeholder).toBe("Fallback title");
		expect(screen.getByText("count 14")).toBeTruthy();
	});

	it("`Input: null`이면 입력 줄 없이 이름표 줄의 `Aside`만 그린다(켜고 끄기)", () => {
		if (!select?.field.input || select.field.kind !== "select") return;
		const off = select.field.defaultValue;
		const on = Object.keys(select.field.options).find((option) => option !== off) ?? off;
		const onChange = renderFields(
			select,
			{ ...EMPTY_FORM, title: "x" },
			{
				[select.field.input]: {
					Input: null,
					Aside: ({ id, onChange: change }) => (
						<button type="button" id={id} onClick={() => change(on)}>
							toggle
						</button>
					),
				},
			},
		);
		expect(screen.queryByRole("combobox")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: select.field.label }));
		expect(onChange).toHaveBeenCalledWith({ [select.name]: on });
	});

	it("등록하지 않은 `input`은 종류의 기본 입력이다", () => {
		if (!text) return;
		renderFields(text, { ...EMPTY_FORM, title: "x", [text.name]: "kept" });
		expect((screen.getByLabelText(text.field.label) as HTMLInputElement).value).toBe("kept");
	});
});

describe("미디어 필드(`fields.media`)", () => {
	it("종류로 미디어 고르기 입력을 그린다. 고른 값은 빼기로 비운다", () => {
		if (!media) return;
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ publicUrl: null }) })),
		);
		const onChange = renderFields(media, {
			...EMPTY_FORM,
			title: "x",
			[media.name]: "11111111-1111-4111-8111-111111111111",
		});
		expect(screen.getByRole("button", { name: media.field.label }).textContent).toBe(t("media.change"));
		fireEvent.click(screen.getByRole("button", { name: t("media.remove") }));
		expect(onChange).toHaveBeenCalledWith({ [media.name]: "" });
	});

	it("비었으면 고르기 버튼이다", () => {
		if (!media) return;
		renderFields(media, { ...EMPTY_FORM, title: "x" });
		expect(screen.getByRole("button", { name: media.field.label }).textContent).toBe(t("media.chooseImage"));
	});
});

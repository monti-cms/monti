import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CmsAdminComponentsProvider } from "../../../admin-components";
import { EMPTY_FORM } from "../entry-form";
import type { FieldInputProps } from "../field-inputs";
import { SchemaFields } from "../schema-fields";

afterEach(cleanup);

/** 사이트가 등록하는 입력(예시). 받은 값을 버튼 하나로 바꾼다. */
function UpperInput({ id, value, onChange }: FieldInputProps) {
	return (
		<button type="button" id={id} onClick={() => onChange(String(value ?? "").toUpperCase())}>
			사이트 입력: {String(value ?? "")}
		</button>
	);
}

describe("사이트가 등록한 필드 입력", () => {
	it("필드의 `input` 이름으로 등록한 입력이 내장 입력 대신 그려진다", () => {
		const onChange = vi.fn();
		render(
			<CmsAdminComponentsProvider components={{ fieldInputs: { "seo-title": UpperInput } }}>
				<SchemaFields
					collection="post"
					form={{ ...EMPTY_FORM, seoTitle: "제목 abc" }}
					context={{ disabled: false }}
					onChange={onChange}
					include={(group) => group.fields.includes("seoTitle")}
				/>
			</CmsAdminComponentsProvider>,
		);
		fireEvent.click(screen.getByText("사이트 입력: 제목 abc"));
		expect(onChange).toHaveBeenCalledWith({ seoTitle: "제목 ABC" });
	});

	it("여러 줄 텍스트 필드는 줄 수(`rows`)만큼의 여러 줄 입력이다", () => {
		render(
			<SchemaFields
				collection="post"
				form={{ ...EMPTY_FORM, summary: "요약" }}
				context={{ disabled: false }}
				onChange={vi.fn()}
				include={(group) => group.fields.includes("summary")}
			/>,
		);
		const input = screen.getByDisplayValue("요약") as HTMLTextAreaElement;
		expect(input.tagName).toBe("TEXTAREA");
		expect(input.rows).toBe(3);
		expect(input.style.minHeight).toBe("4rem");
	});
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CmsAdminComponentsProvider } from "../../../admin-components";
import { EMPTY_FORM } from "../entry-form";
import type { FieldInputProps } from "../field-inputs";
import { SchemaFields } from "../schema-fields";

afterEach(cleanup);

/** An input the site registers (example). Turns the received value into a single button. */
function UpperInput({ id, value, onChange }: FieldInputProps) {
	return (
		<button type="button" id={id} onClick={() => onChange(String(value ?? "").toUpperCase())}>
			사이트 입력: {String(value ?? "")}
		</button>
	);
}

describe("site-registered field input", () => {
	it("an input registered under the field's `input` name renders instead of the built-in input", () => {
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

	it("a multi-line text field is a multi-line input with `rows` rows", () => {
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
	});
});

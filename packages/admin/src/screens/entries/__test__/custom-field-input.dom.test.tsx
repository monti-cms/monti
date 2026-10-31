import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminComponentsProvider } from "../../../admin-components";
import { renderWithSite as render } from "../../../test/site";
import { EMPTY_FORM } from "../entry-form";
import type { FieldInputProps } from "../field-inputs";
import { PropertyFields } from "../property-fields";
import { EntryFormProvider } from "../use-field";

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
	it("PLUG-A2 an input registered under the field's `input` name renders instead of the built-in input, and stays open in the list", () => {
		const onChange = vi.fn();
		render(
			<AdminComponentsProvider components={{ fieldInputs: { "seo-title": UpperInput } }}>
				<EntryFormProvider
					value={{ collection: "post", form: { ...EMPTY_FORM, seoTitle: "제목 abc" }, setForm: onChange }}
				>
					<PropertyFields include={(group) => group.fields.includes("seoTitle")} />
				</EntryFormProvider>
			</AdminComponentsProvider>,
		);
		fireEvent.click(screen.getByText("사이트 입력: 제목 abc"));
		expect(onChange).toHaveBeenCalledWith({ seoTitle: "제목 ABC" });
	});
});

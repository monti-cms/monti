import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { contentCollection } from "../../../../../core/test/any-site";
import { testSite } from "../../../../../core/test/site";
import { AdminComponentsProvider } from "../../../admin-components";
import { renderWithSite as render } from "../../../test/site";
import { EMPTY_FORM } from "../entry-form";
import type { FieldInputProps } from "../field-inputs";
import { PropertyFields } from "../property-fields";
import { EntryFormProvider } from "../use-field";

afterEach(cleanup);

/** The first field of the content collection that names an admin input of its own (`input`), and that name. */
const CUSTOM = testSite.storedFields(contentCollection).flatMap(({ name, field }) => {
	const input = (field as { input?: unknown }).input;
	return typeof input === "string" ? [{ name, input, label: field.label }] : [];
})[0];

/** What the site's input shows before the value. */
const SHOWN = "사이트 입력: ";

/** An input the site registers (example). Turns the received value into a single button. */
function UpperInput({ id, value, onChange }: FieldInputProps) {
	return (
		<button type="button" id={id} onClick={() => onChange(String(value ?? "").toUpperCase())}>
			{SHOWN}
			{String(value ?? "")}
		</button>
	);
}

describe.skipIf(!CUSTOM)("site-registered field input", () => {
	it("PLUG-A2 an input registered under the field's `input` name renders instead of the built-in input, and stays open in the list", () => {
		const { name, input, label } = CUSTOM as NonNullable<typeof CUSTOM>;
		const onChange = vi.fn();
		render(
			<AdminComponentsProvider components={{ fieldInputs: { [input]: UpperInput } }}>
				<EntryFormProvider
					value={{ collection: contentCollection, form: { ...EMPTY_FORM, [name]: "제목 abc" }, setForm: onChange }}
				>
					<PropertyFields include={(group) => group.fields.includes(name)} />
				</EntryFormProvider>
			</AdminComponentsProvider>,
		);
		// The field's label names the site's input, which got the value.
		const button = screen.getByRole("button", { name: label });
		expect(button.textContent).toBe(`${SHOWN}제목 abc`);
		fireEvent.click(button);
		expect(onChange).toHaveBeenCalledWith({ [name]: "제목 ABC" });
	});
});

import { TooltipProvider } from "@monti-cms/ui";
import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { renderWithSite as render } from "../../../test/site";
import { EMPTY_FORM } from "../entry-form";
import { entriesMessages } from "../messages";
import { PropertyFields } from "../property-fields";
import { EntryFormProvider } from "../use-field";

const t = testSite.createTranslator(entriesMessages);

afterEach(cleanup);

describe("select value that is no longer an option", () => {
	const found = testSite.COLLECTIONS.flatMap((name) =>
		testSite
			.storedFields(name)
			.filter(({ field, when }) => !when && field.kind === "select" && !field.input)
			.map((stored) => ({ collection: name, ...stored })),
	)[0];

	/** `skipIf` below leaves out a config without such a select, so the test reads it as found. */
	const select = found as NonNullable<typeof found>;

	it.skipIf(!found)("WRITE-S8 shows the stored value marked as no longer an option instead of the default", () => {
		render(
			<TooltipProvider>
				<EntryFormProvider
					value={{
						collection: select.collection,
						form: { ...EMPTY_FORM, [select.name]: "removed-option" },
						setForm: () => {},
					}}
				>
					<PropertyFields include={(group) => group.fields.includes(select.name)} />
				</EntryFormProvider>
			</TooltipProvider>,
		);
		expect(screen.getByRole("button", { name: new RegExp(`^${select.field.label}`) }).textContent).toBe(
			t("select.removedOption", { value: "removed-option" }),
		);
	});
});

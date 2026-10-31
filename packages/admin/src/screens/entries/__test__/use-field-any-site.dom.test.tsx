import { act, cleanup, fireEvent, renderHook, screen } from "@testing-library/react";
import { memo, type ReactNode, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { EntryFormProvider, type EntryFormValue, useField } from "../../../hooks/public";
import { renderWithSite as render, SiteWrapper } from "../../../test/site";
import { EMPTY_FORM, type EntryForm } from "../entry-form";

/**
 * `useField` checks that do not depend on the site config (regression guard): they use the default collection and its `title` field,
 * and plain keys for everything else. `use-field.dom.test.tsx` covers the reference blog's own fields.
 */

afterEach(cleanup);

const value = (overrides: Partial<EntryFormValue> = {}): EntryFormValue => ({
	collection: testSite.DEFAULT_COLLECTION,
	form: { ...EMPTY_FORM },
	setForm: vi.fn(),
	...overrides,
});

const wrapper =
	(provided: EntryFormValue) =>
	({ children }: { children: ReactNode }) => (
		<SiteWrapper>
			<EntryFormProvider value={provided}>{children}</EntryFormProvider>
		</SiteWrapper>
	);

describe("useField on any site", () => {
	it("TRASH-T7 a disabled form is read-only and ignores changes", () => {
		const setForm = vi.fn();
		const { result } = renderHook(() => useField<string>("title"), {
			wrapper: wrapper(value({ disabled: true, setForm })),
		});
		expect(result.current.readOnlyReason).toBe("disabled");
		act(() => result.current.setValue("x"));
		expect(setForm).not.toHaveBeenCalled();
	});
});

import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { EntryFormProvider, type EntryFormValue, useField } from "../../../hooks/public";
import { SiteWrapper } from "../../../test/site";
import { EMPTY_FORM } from "../entry-form";

/**
 * `useField` checks that do not depend on the site config (regression guard): they use the default collection and its `title` field,
 * and plain keys for everything else. `use-field.dom.test.tsx` covers fields looked up from the config.
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

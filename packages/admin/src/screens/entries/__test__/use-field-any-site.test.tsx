import { DEFAULT_COLLECTION } from "@monti-cms/core/client";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { memo, type ReactNode, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EntryFormProvider, type EntryFormValue, useField } from "../../../hooks/public";
import { EMPTY_FORM, type EntryForm } from "../entry-form";

/**
 * `useField` checks that do not depend on the site config (regression guard): they use the default collection and its `title` field,
 * and plain keys for everything else. `use-field.test.tsx` covers the reference blog's own fields.
 */

afterEach(cleanup);

const value = (overrides: Partial<EntryFormValue> = {}): EntryFormValue => ({
	collection: DEFAULT_COLLECTION,
	form: { ...EMPTY_FORM },
	setForm: vi.fn(),
	...overrides,
});

const wrapper =
	(provided: EntryFormValue) =>
	({ children }: { children: ReactNode }) => <EntryFormProvider value={provided}>{children}</EntryFormProvider>;

describe("useField on any site", () => {
	it("gives the value, a patch-only change, the error and the ids of the title field", () => {
		const setForm = vi.fn();
		const issues = [{ code: "missing_field", path: "title" }];
		const { result } = renderHook(() => useField<string>("title"), {
			wrapper: wrapper(value({ form: { ...EMPTY_FORM, title: "Hello" }, setForm, issues })),
		});
		expect(result.current.value).toBe("Hello");
		expect(result.current.definition).toBeDefined();
		expect(result.current.invalid).toBe(true);
		expect(result.current.inputProps).toEqual({
			id: "cms-title",
			"aria-invalid": true,
			"aria-describedby": "cms-title-error",
		});
		act(() => result.current.setValue("Changed"));
		expect(setForm).toHaveBeenCalledWith({ title: "Changed" });
	});

	it("a disabled form is read-only and ignores changes", () => {
		const setForm = vi.fn();
		const { result } = renderHook(() => useField<string>("title"), {
			wrapper: wrapper(value({ disabled: true, setForm })),
		});
		expect(result.current.readOnlyReason).toBe("disabled");
		act(() => result.current.setValue("x"));
		expect(setForm).not.toHaveBeenCalled();
	});

	it("typing in one field does not re-render another field's component", () => {
		const renders: Record<string, number> = {};
		const Probe = memo(function Probe({ name }: { name: string }) {
			const field = useField<string>(name);
			renders[name] = (renders[name] ?? 0) + 1;
			return (
				<input aria-label={name} value={field.value ?? ""} onChange={(event) => field.setValue(event.target.value)} />
			);
		});
		function Owner({ children }: { children: ReactNode }) {
			const [form, setForm] = useState<EntryForm>({ ...EMPTY_FORM, title: "a", other: "b" });
			return (
				<EntryFormProvider
					value={value({ form, setForm: (patch) => setForm((current) => ({ ...current, ...patch })) })}
				>
					{children}
				</EntryFormProvider>
			);
		}
		render(
			<Owner>
				<Probe name="title" />
				<Probe name="other" />
			</Owner>,
		);
		fireEvent.change(screen.getByLabelText("title"), { target: { value: "ab" } });
		expect((screen.getByLabelText("title") as HTMLInputElement).value).toBe("ab");
		expect(renders).toEqual({ title: 2, other: 1 });
	});
});

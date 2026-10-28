import { Add, View } from "@carbon/icons-react";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { AdminComponentsProvider } from "../../../admin-components";
import { useIconByName } from "../collection-icon";

describe("icon picked by name", () => {
	it("picks built-in icons and provider-registered icons; unknown names give none", () => {
		const wrapper = ({ children }: { children: ReactNode }) => (
			<AdminComponentsProvider components={{ icons: { view: View } }}>{children}</AdminComponentsProvider>
		);
		const { result } = renderHook(() => useIconByName(), { wrapper });
		expect(result.current("add")).toBe(Add);
		expect(result.current("view")).toBe(View);
		expect(result.current("workflow")).toBeUndefined();
		expect(result.current(undefined)).toBeUndefined();
	});
});

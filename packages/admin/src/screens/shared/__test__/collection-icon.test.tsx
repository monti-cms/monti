import { renderHook } from "@testing-library/react";
import { Eye, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { CmsAdminComponentsProvider } from "../../../admin-components";
import { useIconByName } from "../collection-icon";

describe("icon picked by name", () => {
	it("picks built-in icons and provider-registered icons; unknown names give none", () => {
		const wrapper = ({ children }: { children: ReactNode }) => (
			<CmsAdminComponentsProvider components={{ icons: { eye: Eye } }}>{children}</CmsAdminComponentsProvider>
		);
		const { result } = renderHook(() => useIconByName(), { wrapper });
		expect(result.current("plus")).toBe(Plus);
		expect(result.current("eye")).toBe(Eye);
		expect(result.current("workflow")).toBeUndefined();
		expect(result.current(undefined)).toBeUndefined();
	});
});

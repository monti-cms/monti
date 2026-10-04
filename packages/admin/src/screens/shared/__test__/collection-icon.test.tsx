import { renderHook } from "@testing-library/react";
import { Eye, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { CmsAdminComponentsProvider } from "../../../admin-components";
import { useIconByName } from "../collection-icon";

describe("이름으로 고르는 아이콘", () => {
	it("본체 아이콘과 공급자가 등록한 아이콘을 고르고, 모르는 이름은 없다", () => {
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

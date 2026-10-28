import { View } from "@carbon/icons-react";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { AdminComponentsProvider } from "../../../admin-components";
import { COLLECTION_ICON_NAMES, ICONS, useIconByName } from "../collection-icon";

describe("icon picked by name", () => {
	it("picks built-in and provider-registered icons, a registered one first; unknown names give none", () => {
		const builtIn = COLLECTION_ICON_NAMES[0] as string;
		const wrapper = ({ children }: { children: ReactNode }) => (
			<AdminComponentsProvider components={{ icons: { custom: View, [builtIn]: View } }}>
				{children}
			</AdminComponentsProvider>
		);
		const { result } = renderHook(() => useIconByName(), { wrapper });
		expect(result.current("custom")).toBe(View);
		expect(result.current(builtIn)).toBe(View);
		const other = COLLECTION_ICON_NAMES.find((name) => name !== builtIn) as string;
		expect(result.current(other)).toBe(ICONS[other]);
		expect(result.current("not-an-icon")).toBeUndefined();
		expect(result.current(undefined)).toBeUndefined();
	});
});

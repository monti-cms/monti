"use client";

import { type CmsAdminComponents, CmsAdminComponentsProvider } from "@monti-cms/admin";
import { SquareStack } from "lucide-react";
import type { ReactNode } from "react";
import { TabNodeView, TabsNodeView } from "./view";

const components: CmsAdminComponents = {
	blockViews: { tabs: TabsNodeView, tab: TabNodeView },
	icons: { "square-stack": SquareStack },
};

/** 탭 블록의 편집 화면과 메뉴 아이콘을 관리자 화면에 넣는다. */
export function TabsProvider({ children }: { children: ReactNode }) {
	return <CmsAdminComponentsProvider components={components}>{children}</CmsAdminComponentsProvider>;
}

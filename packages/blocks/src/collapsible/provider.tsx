"use client";

import { type CmsAdminComponents, CmsAdminComponentsProvider } from "@monti-cms/admin";
import { ChevronsUpDown } from "lucide-react";
import type { ReactNode } from "react";
import { CollapsibleNodeView } from "./view";

const components: CmsAdminComponents = {
	blockViews: { collapsible: CollapsibleNodeView },
	icons: { "chevrons-up-down": ChevronsUpDown },
};

/** 접기 블록의 편집 화면과 메뉴 아이콘을 관리자 화면에 넣는다. */
export function CollapsibleProvider({ children }: { children: ReactNode }) {
	return <CmsAdminComponentsProvider components={components}>{children}</CmsAdminComponentsProvider>;
}

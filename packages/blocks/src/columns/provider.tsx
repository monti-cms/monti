"use client";

import { type CmsAdminComponents, CmsAdminComponentsProvider } from "@monti-cms/admin";
import { Columns2 } from "lucide-react";
import type { ReactNode } from "react";
import { ColumnNodeView, ColumnsNodeView } from "./view";

const components: CmsAdminComponents = {
	blockViews: { columns: ColumnsNodeView, column: ColumnNodeView },
	icons: { "columns-2": Columns2 },
};

/** 단 나누기 블록의 편집 화면과 메뉴 아이콘을 관리자 화면에 넣는다. */
export function ColumnsProvider({ children }: { children: ReactNode }) {
	return <CmsAdminComponentsProvider components={components}>{children}</CmsAdminComponentsProvider>;
}

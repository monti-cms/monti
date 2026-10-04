"use client";

import { type CmsAdminComponents, CmsAdminComponentsProvider } from "@monti-cms/admin";
import { MessageSquareWarning } from "lucide-react";
import type { ReactNode } from "react";
import { CalloutNodeView } from "./view";

const components: CmsAdminComponents = {
	blockViews: { callout: CalloutNodeView },
	icons: { "message-square-warning": MessageSquareWarning },
};

/** 콜아웃 블록의 편집 화면과 메뉴 아이콘을 관리자 화면에 넣는다. */
export function CalloutProvider({ children }: { children: ReactNode }) {
	return <CmsAdminComponentsProvider components={components}>{children}</CmsAdminComponentsProvider>;
}

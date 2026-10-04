"use client";

import { type CmsAdminComponents, CmsAdminComponentsProvider } from "@monti-cms/admin";
import { Workflow } from "lucide-react";
import type { ReactNode } from "react";

const components: CmsAdminComponents = {
	icons: { workflow: Workflow },
	// 기본 미리보기. 미리보기를 열 때만 `mermaid`를 불러온다. 사이트가 같은 이름으로 넣으면 그것이 이긴다(안쪽 공급자).
	fencePreviews: { mermaid: () => import("./preview").then(({ MermaidPreview }) => MermaidPreview) },
};

/** Mermaid 다이어그램 블록의 메뉴 아이콘과 편집기 미리보기를 관리자 화면에 넣는다. */
export function MermaidProvider({ children }: { children: ReactNode }) {
	return <CmsAdminComponentsProvider components={components}>{children}</CmsAdminComponentsProvider>;
}

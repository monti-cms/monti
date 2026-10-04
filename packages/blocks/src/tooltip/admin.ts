import { defineAdminPlugin } from "@monti-cms/admin/plugins";
import { TooltipProvider } from "./provider";

/** 편집기 등록(테스트·직접 만든 화면에서 `CmsAdminComponentsProvider`의 `marks`에 넣을 때). */
export { OPEN_TOOLTIP_EVENT, TOOLTIP_MARK, TooltipProvider, tooltipMarkExtension } from "./provider";

/** 툴팁 확장의 관리자 화면 쪽. 편집기의 툴팁 표시·도구를 넣는다. */
export default defineAdminPlugin({ Provider: TooltipProvider });

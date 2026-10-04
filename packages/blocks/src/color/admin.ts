import { defineAdminPlugin } from "@monti-cms/admin/plugins";
import { ColorProvider } from "./provider";

/** 편집기 등록(테스트·직접 만든 화면에서 `CmsAdminComponentsProvider`의 `marks`에 넣을 때). */
export { ColorProvider, colorMarkAttributes, colorMarkExtension } from "./provider";

/** 글자색 확장의 관리자 화면 쪽. 편집기의 글자색 표시·도구를 넣는다. */
export default defineAdminPlugin({ Provider: ColorProvider });

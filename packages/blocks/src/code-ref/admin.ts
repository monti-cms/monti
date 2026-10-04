import { defineAdminPlugin } from "@monti-cms/admin/plugins";
import { CodeRefProvider } from "./provider";

/** 편집기 등록(테스트·직접 만든 화면에서 `CmsAdminComponentsProvider`의 `marks`에 넣을 때). */
export { CODE_REF_MARK, CodeRefProvider, codeRefMarkExtension } from "./provider";

/** 코드 연결 확장의 관리자 화면 쪽. 편집기의 코드 연결 표시·버블을 넣는다. */
export default defineAdminPlugin({ Provider: CodeRefProvider });

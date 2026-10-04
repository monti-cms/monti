import { defineAdminPlugin } from "@monti-cms/admin/plugins";
import { SeoAdminProvider } from "./admin/provider";

/** SEO 확장의 관리자 화면 쪽. 검색 미리보기·글자 수·숨기기 스위치를 등록한다. */
export default defineAdminPlugin({ Provider: SeoAdminProvider });

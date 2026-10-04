import { defineAdminPlugin } from "@monti-cms/admin/plugins";
import { CalloutProvider } from "./provider";

/** 콜아웃 블록 플러그인의 관리자 화면 쪽. 편집 화면 전체(`blockViews`)를 넣는다. */
export default defineAdminPlugin({ Provider: CalloutProvider });

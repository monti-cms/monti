import { defineAdminPlugin } from "@monti-cms/admin/plugins";
import { CollapsibleProvider } from "./provider";

/** 접기 블록 플러그인의 관리자 화면 쪽. 편집 화면 전체(`blockViews`)를 넣는다. */
export default defineAdminPlugin({ Provider: CollapsibleProvider });

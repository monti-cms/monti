import { defineAdminPlugin } from "@monti-cms/admin/plugins";
import { ChartProvider } from "./provider";

/** 차트 블록 플러그인의 관리자 화면 쪽. 메뉴 아이콘을 넣는다. */
export default defineAdminPlugin({ Provider: ChartProvider });

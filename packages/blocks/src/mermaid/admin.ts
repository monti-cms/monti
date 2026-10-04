import { defineAdminPlugin } from "@monti-cms/admin/plugins";
import { MermaidProvider } from "./provider";

/** Mermaid 다이어그램 블록 플러그인의 관리자 화면 쪽. 메뉴 아이콘을 넣는다. */
export default defineAdminPlugin({ Provider: MermaidProvider });

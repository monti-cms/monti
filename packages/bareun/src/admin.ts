import { defineAdminPlugin } from "@monti-cms/admin/plugins";
import { BareunProvider } from "./provider";

/** 바른 검사기의 관리자 화면 쪽. 편집기 맞춤법 검사에 검사기를 넣는다. */
export default defineAdminPlugin({ Provider: BareunProvider });

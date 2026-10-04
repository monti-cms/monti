import { defineAdminPlugin } from "@monti-cms/admin/plugins";
import { AiManager } from "./ai-manager";
import { AiAdminProvider } from "./provider";

/**
 * AI 플러그인의 관리자 화면 쪽. 관리자 화면이 사이트 설정의 `aiPlugin()`을 보고 불러온다.
 * 직접 만든 화면에서는 `useAiAction("이름")`이나 `<AiButton action="이름" />`으로 기능을 부른다.
 */
export default defineAdminPlugin({ pages: { ai: AiManager }, Provider: AiAdminProvider });

export { AiButton, type AiButtonProps } from "./ai-button";
export { type UseAiAction, useAiAction } from "./use-ai-action";

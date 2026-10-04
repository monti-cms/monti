import { defineMessages } from "@monti-cms/core";
/** Texts shared by the AI button, model list, AI run requests and the test input fields. */
export const aiCommonMessages = defineMessages("cms-ai.admin.common", {
    en: {
        runFailed: "Couldn't run.",
        slotMenu: "AI",
        running: "Running…",
        listFailed: "Couldn't load the AI actions.",
        streamCut: "The AI answer was cut off before it finished.",
        modelsFailed: "Couldn't get the model list.",
        modelsLoading: "Loading list…",
        modelsHint: "Enter a model name.",
        modelUse: "Use '{label}'",
        sampleMediaId: "{label} · media ID or path",
    },
    ko: {
        runFailed: "실행하지 못했습니다.",
        slotMenu: "AI",
        running: "실행 중…",
        listFailed: "AI 기능 목록을 불러올 수 없습니다.",
        streamCut: "AI 답이 끝나기 전에 끊겼습니다.",
        modelsFailed: "모델 목록을 받지 못했습니다.",
        modelsLoading: "목록 받는 중…",
        modelsHint: "모델 이름을 입력하세요.",
        modelUse: "'{label}' 사용",
        sampleMediaId: "{label} · 미디어 ID 또는 경로",
    },
});

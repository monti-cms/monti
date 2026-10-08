import { defineMessages } from "@monti-cms/core";
/**
 * Fixed text that public page blocks show to readers. Chosen by the content language, not the admin language (`context.locale`).
 * Chart syntax error text lives in `chart/messages`.
 */
export const publicLabelMessages = defineMessages("cms-blocks.public", {
    en: {
        calloutNote: "Note",
        calloutTip: "Tip",
        calloutInfo: "Info",
        calloutWarning: "Warning",
        calloutDanger: "Danger",
        collapsibleFallback: "Show more",
        codeExplorerFiles: "Files",
        codeExplorerToggle: "Show or hide the file list",
    },
    ko: {
        calloutNote: "노트",
        calloutTip: "팁",
        calloutInfo: "정보",
        calloutWarning: "경고",
        calloutDanger: "위험",
        collapsibleFallback: "펼치기",
        codeExplorerFiles: "파일",
        codeExplorerToggle: "파일 목록 열기 또는 닫기",
    },
    ja: {
        calloutNote: "ノート",
        calloutTip: "ヒント",
        calloutInfo: "情報",
        calloutWarning: "警告",
        calloutDanger: "危険",
        collapsibleFallback: "開く",
        codeExplorerFiles: "ファイル",
        codeExplorerToggle: "ファイル一覧を開閉",
    },
});

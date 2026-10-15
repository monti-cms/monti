import { defineMessages } from "@monti-cms/core";
/** Texts of the basic-info inputs of a screen action (name, attach target, result, mode). */
export const customMessages = defineMessages("cms-ai.admin.custom", {
    en: {
        "field.name": "Name",
        "field.place": "Placement",
        "field.field": "Field",
        "field.result": "Result",
        "field.engine": "Mode",
        "place.field": "Next to a field",
        "place.media": "Media",
        "place.hint.field": "Appears as an AI button beside the selected field.",
        "place.hint.selection": "Appears in the floating toolbar when text is highlighted in the body.",
        "place.hint.insert": "Appears in the slash ('/') block menu in the body editor.",
        "place.hint.block": "Appears on the block handle in the body editor.",
        "place.hint.image": "Appears beside the alt text or caption of an image in the body.",
        "place.hint.media": "Appears beside the corresponding item in media library details.",
    },
    ko: {
        "field.name": "이름",
        "field.place": "붙을 곳",
        "field.field": "필드",
        "field.result": "결과",
        "field.engine": "방식",
        "place.field": "필드 옆",
        "place.media": "미디어",
        "place.hint.field": "선택한 필드 옆에 AI 버튼으로 표시됩니다.",
        "place.hint.selection": "본문에서 글자를 드래그해 선택했을 때 툴바에 표시됩니다.",
        "place.hint.insert": "본문 에디터에서 빈 줄이나 '/' 키를 입력했을 때 블록 삽입 메뉴에 표시됩니다.",
        "place.hint.block": "본문 블록 옆 핸들 버튼에 표시됩니다.",
        "place.hint.image": "본문 이미지 블록의 대체 텍스트나 캡션 옆에 표시됩니다.",
        "place.hint.media": "미디어 라이브러리 상세 화면의 해당 항목 옆에 표시됩니다.",
    },
});

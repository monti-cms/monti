import { defineMessages } from "@monti-cms/core";
/** Messages for action definition and run request validation (shown in the admin UI as API errors). */
export const coreMessages = defineMessages("cms-ai.core", {
    en: {
        "image.missing": "There is no image.",
        "run.inputOrInputs": "Send either input or inputs, not both.",
        "check.invalidRegex": "This is not a valid regular expression.",
    },
    ko: {
        "image.missing": "이미지가 없습니다.",
        "run.inputOrInputs": "input과 inputs 중 하나만 보낸다.",
        "check.invalidRegex": "올바르지 않은 정규식입니다.",
    },
});

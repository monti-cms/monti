import { defineMessages } from "@monti-cms/core";
/** Error messages for AI service connections and key encryption. */
export const providerMessages = defineMessages("cms-ai.provider", {
    en: {
        "service.key": "Check the AI service key.",
        "service.credit": "The AI service has run out of credit.",
        "service.address": "Check the AI service address or model name.",
        "service.rateLimited": "There are too many AI requests. Try again shortly.",
        "service.problem": "The AI service has a problem.",
        streamCut: "The AI answer was cut off while it was being received.",
        tooLong: "The AI answer was too long to receive in full.",
        tooLongModel: "The AI answer was too long to receive in full. If the model thinks for a long time, try another model.",
        unreadable: "The result couldn't be read from the AI answer. Try another model.",
        deciderUnreachable: "Couldn't connect to the decision model address.",
        deciderShape: "The decision model's answer has the wrong format.",
        unreachable: "Couldn't connect to the address.",
        noSecret: "MONTI_SECRET is not set on the server, so the key can't be saved.",
    },
    ko: {
        "service.key": "AI 서비스 키를 확인하세요.",
        "service.credit": "AI 서비스 크레딧이 부족합니다.",
        "service.address": "AI 서비스 주소나 모델 이름을 확인하세요.",
        "service.rateLimited": "AI 요청이 많습니다. 잠시 뒤 다시 시도하세요.",
        "service.problem": "AI 서비스에 문제가 있습니다.",
        streamCut: "AI 답을 받는 중에 끊겼습니다.",
        tooLong: "AI 답이 길어 끝까지 받지 못했습니다.",
        tooLongModel: "AI 답이 길어 끝까지 받지 못했습니다. 생각을 오래 하는 모델이면 다른 모델을 골라 보세요.",
        unreadable: "AI 답에서 결과를 읽지 못했습니다. 다른 모델을 골라 보세요.",
        deciderUnreachable: "판단 모델 주소에 연결하지 못했습니다.",
        deciderShape: "판단 모델 답의 형식이 맞지 않습니다.",
        unreachable: "주소에 연결하지 못했습니다.",
        noSecret: "서버에 MONTI_SECRET이 없어 키를 저장할 수 없습니다.",
    },
});

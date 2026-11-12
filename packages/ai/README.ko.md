# @monti-cms/ai

Monti의 어시스턴트다. core는 AI를 모른다. core에는 기능(어시스턴트의 도구가 된다), 제안, 키가 있다. 이 패키지는 모델을 부르는 것을 더한다:
실행 엔진, 모델 공급자, 빠른 작업.

```ts
import { assistant } from "@monti-cms/ai";
import { defineConfig } from "@monti-cms/core";

export default defineConfig({
	// …
	plugins: [assistant()],
});
```

- **실행**은 요청 하나와 그에 답하는 턴들이다: 모델에 묻고, 모델이 부른 도구를 돌리고, 다시 묻는다. 흐름 `assistant.run`이다
  (`POST …/streams/assistant.run`, 이벤트는 한 줄에 JSON 하나). 읽기는 바로 돌고, 쓰기는 제안의 항목이 되어 사람이 적용하기 전에는 아무것도
  바꾸지 않고, 화면 도구는 브라우저로 가서 실행이 그 답을 기다린다. 하는 일을 그때그때 저장하므로, 끊긴 실행(시간 한도, 연결 끊김)은
  `resume`으로 하던 곳에서 이어 간다.
- **도구**는 사이트의 기능이고 플러그인의 기능도 든다(`assistant.tools`가 나열한다). 여기 코드는 도구 이름을 하나도 적지 않는다. 기능을
  더하면 도구가 생긴다.
- **빠른 작업**(`assistant.fill`)은 빠른 작업 모델을 한 번 불러 칸 하나를 채운다. 루프도 도구도 없고 저장하는 것도 없다.
- **공급자.** 엔진은 모델 서비스를 `ModelProvider`(도구가 있는 턴 하나, 정해진 모양의 답 하나)로만 안다. 진짜 공급자는 AI SDK 위에
  있다(`aiSdkProvider`): Anthropic, OpenAI, Google, OpenRouter, OpenAI 호환 서버. 저마다 API 키 화면이 저장한 키로 부른다. 테스트와
  Storybook은 시킨 말만 하는 모델 `scriptedProvider`를 쓴다. 어떤 테스트도 모델을 부르지 않는다.

```ts
import { assistant, scriptedProvider } from "@monti-cms/ai";

const model = scriptedProvider([
	{ calls: [{ name: "entries_query", input: { collection: "post" } }] },
	{ text: "요약이 없는 글은 두 편입니다." },
]);
createMonti({ db, schema, secret, plugins: [assistant({ provider: model.for })] });
```

확인하지 못한 것: 어떤 테스트도 모델 서비스를 부르지 않는다. 손으로는 OpenRouter만, 무료 모델 둘로 불러 봤다(2026-11-12: 키 확인, 글이 오는 턴과 사용량, 도구 호출과 그 답, 정해진 모양의 답, 거절, 신호로 끝낸 턴, 생각 조각, 한 요청에 도구 65개, 실행 하나). 다른 서비스, 긴 침묵, 길이로 잘린 답, Anthropic 모델에 보내는 캐시 표시는 진짜 서비스에 대고 해 보지 못했다. 어댑터는 AI SDK(`ai` 7, `@ai-sdk/*` 4)가 읽는 서비스마다의
답 모양(Anthropic Messages, OpenAI Responses, Google generateContent, OpenRouter와 호환 서버의 chat completions)으로 확인했다. 서비스가 지금 그
모양으로 답하는지, 모델 id와 생각 옵션이 받아들여지는지는 확인하지 않았다. 어댑터는 API 버전을 맞춰 보지 않는다. Anthropic의
`anthropic-version`은 AI SDK가 보내는 값이다. 설치된 AI SDK보다 새 Claude 모델은 SDK가 답을 4,096 토큰으로 묶는다. 그때는 SDK를 올린다.

키는 제 서비스로만 간다. 내장 서비스는 정해진 주소 하나로만 부르고(서버 환경 변수의 주소, 예를 들어 `ANTHROPIC_BASE_URL`은 쓰지 않는다),
키를 실은 요청은 리다이렉트를 따라가지 않는다.

설계는 `docs/design/features/10-assistant.md`에 있다.

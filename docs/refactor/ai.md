# `@monti-cms/ai` 리팩토링 이관 기록

상태: 이관 범위 합의, 상세 설계·구현 대기 (2026-11-18). 기존 메인 체크아웃 초안의 새 테이블 이름을 확정으로 취급하지 않고 [core.md](core.md)에서 뺀 실제 책임을 기록한다.

## 1. AI 데이터와 모델

- 대화·실행·메시지·받은 지시·AI 설정·모델 선택 데이터(`conversations`, `runs`, `run_messages`, `run_inbox`, `assistant_settings`, `model_choices`)를 core DB에서 분리한다.
- `monti_proposal`, `monti_proposal_item`과 `engine/proposals.ts`, 제안 검토·적용 책임을 받는다. core는 제안을 저장하거나 승인하지 않는다.
- API 키의 `models`, `models_at`, `models_failed_at`, `api_key_usage`와 모델 목록·사용량·예산 책임을 받는다. 공급자 목록(`aiServices`), `models.list`, `models.choose`, `tryModel`의 AI 동작도 이쪽에 둔다.
- 테이블의 최종 이름·개수는 AI 설계에서 정한다. 플러그인 DB 등록의 공개 이름·입력 형태는 core의 T313에서 다시 정한다. 현재의 `Plugin.migrations` 예시는 확정 계약으로 사용하지 않는다.
- API 키 원본의 암호화 보관은 core의 `api_keys`·`keys.*`를 사용한다. AI 공급자의 `keyServices` 규격·연결 검사는 AI가 등록하며 별도 금고를 만들지 않는다.

## 2. Operation과 도구

- core의 공개 Operation 명세를 LLM 도구로 변환한다. 도구 설명·프롬프트·노출 정책은 AI가 책임지며 core에 `description`, `humanOnly`, `structure`, `actor` 플래그를 복원하지 않는다.
- 인증·계정·영구 삭제·키 원본 등 노출을 제한할 도구와 개발 모드에서만 제공할 도구의 정책은 이 패키지에서 정한다. core의 데이터 규칙과 개발 모드 검증은 도구 노출 여부와 무관하게 적용된다.
- 기존 `entry/tools.ts`, `entries.missingAlt`, `body.read`, `body.edit`를 AI 도구 계층으로 옮긴다.
- `body/inline-text.ts`, `body/text.ts` 등 AI용 본문 문자열 변환·부분 편집도 이쪽에서 담당한다. core의 공개 문서 규격을 사용하되 AI 편집 표현을 core JSON 규격에 섞지 않는다.
- `kind: "screen"` 도구는 [admin.md](admin.md)와 연결한다. core의 DB Operation으로 실행하지 않는다.

## 3. 제안 검증·승인

- 조회는 공개 Operation을 직접 호출한다. 쓰기 제안은 core의 `dryRun`으로 동일 `run`을 실행해 결과를 확인한 뒤 AI의 제안 데이터에 `{ operation, input, output }`을 보관한다.
- 연속 제안은 선행 작업까지 함께 시험한다. 생성 입력의 선택적 UUID를 미리 지정해 제안과 실제 적용을 연결하며 `$item` 같은 참조 문법을 만들지 않는다.
- 승인한 제안은 `transaction`으로 적용한다. 다중 대상의 일부 선택은 admin이 추린 ID를 입력으로 사용한다.
- `preview`, `places`, `follows`, `each`나 별도 사전 검사 훅을 core에 되살리지 않는다.
- LLM 스트리밍·실행 중단·제안 상태 알림은 AI와 서버 연결 계층이 담당한다. core에 AI 전용 `streams`, `cleanUp` 슬롯을 만들지 않는다.

## 4. 이 패키지의 테스트 계획 전에 정할 것

- AI 자체 Operation, 테이블 구조, 도구 노출 정책, 승인 상태와 스트리밍 계약.
- AI용 본문 편집 표현과 문서 JSON 사이의 변환·오류 처리.
- admin의 UI 도구·제안 표시와 서버 알림을 연결하는 방식.

이 목록은 책임의 이관이며 공급자·모델·새 도구 기능을 추가로 확정한 목록이 아니다.

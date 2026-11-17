# Markdown·MDX 변환 이관 기록

상태: core 내장 방침 철회, 외부 기능으로 유지 (2026-11-17 합의, 2026-11-18 기록 정리).

## 1. 담당하는 일

- `@monti-cms/mdx` 등 외부 변환 패키지가 Markdown/MDX와 Monti 문서 JSON 사이의 읽기·쓰기를 담당한다.
- 기존 core의 `markdown/`, `@monti-cms/core/markdown`과 MDX 패키지의 읽기·쓰기·미변환 블록 처리 책임을 이곳에서 정리한다. `mdast`·`micromark` 등 변환 의존성은 core에서 제거한다.
- 가져오기는 외부에서 Monti 데이터로 변환한 뒤 core의 `data.import` 등 공개 Operation을 사용한다. 내보내기는 core에서 읽은 데이터를 외부에서 변환한다. core는 MDX 문법을 알지 않는다.
- 어시스턴트 답변 등 admin이 쓰는 Markdown 읽기도 이 외부 변환기를 사용한다. 변환 패키지가 admin을 import하지 않게 한다.
- 코드 펜스·메타 문자열 같은 Markdown 문법은 이쪽에서 다루고, 코드 블록 데이터의 의미는 [blocks.md](blocks.md)의 계약을 사용한다.
- 미변환 블록의 보존·검사·검토 표시도 이 외부 기능과 admin의 연결에서 담당한다. 화면 확장은 `AdminPlugin`을 사용하며 core의 `publishChecks`, `importers`, `documentViews`, `attach`를 복원하지 않는다.

## 2. 이 패키지의 테스트 계획 전에 정할 것

- 읽기·쓰기의 공개 함수와 export, admin이 필요한 읽기 기능을 소비하는 경로.
- 사용자 블록·서식 변환과 왕복 시 데이터 보존 규칙.
- 미변환 데이터의 표현, 경고·발행 제한 필요 여부와 이를 연결하는 방식. core에는 문서 데이터 검증만 남긴다.

외부에 유지한다는 결정은 기본 설치 포함 여부나 새 플러그인 API를 확정한 뜻이 아니다. 사용자의 선택과 설치 흐름은 CLI·관리자 연결 작업에서 정한다.

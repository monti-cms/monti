# `parse/` 인수 조건

[`docs/refactor/cli.md`](../../refactor/cli.md) 2절(명령 체계), 4절(입력 파싱 규칙·종료 코드), 6절(`parse/`)의 인수 조건이다.

| 기능 | 하는 일 | 주요 거절 |
|---|---|---|
| 전역 옵션·명령 분리 (`args.ts`) | `--config`, `--schema`, `--migrations`, `--input`, `--dry-run`, `--help`/`-h`, `--version`/`-v`와 서브커맨드·개별 플래그를 분리한다 | 값 누락 옵션 시 사용법 오류 |
| 입력 변환 (`input.ts`) | `--input` JSON/`--input -`(stdin) 또는 스칼라 `--key value`·`--flag`를 `OperationSpec.input` 타입에 맞춰 JS 객체로 만든다 | `--input`+개별 플래그 혼용, JSON 문법 오류, 숫자 자리 비숫자 값 시 사용법 오류 |
| 도움말 (`help.ts`) | 전체 도움말과 `OperationSpec[]` 기반 리소스·작업별 도움말 텍스트를 생성한다 | 없음 |

---

## 1. 명령줄 파싱과 입력 변환 (`args` · `input` · `help`)

### 핵심 요구사항

<details>
<summary><strong><code>CLI-PRS-1</code></strong> `--config`, `--schema`, `--migrations`, `--dry-run` 같은 전역 옵션과 실행할 명령을 분리한다</summary>

- **전제**: 명령줄 인자 배열에 전역 옵션(`--config`, `--schema`, `--migrations`, `--dry-run`)과 서브커맨드(`entries`, `list`), 개별 옵션(`--collection`, `posts`)이 섞여 있다
- **행동**: 인자 배열을 파싱한다
- **결과**:
  - `CLI-PRS-1.1` 전역 옵션 `config`, `schema`, `migrations`, `dryRun`이 각각의 값으로 해석된다
  - `CLI-PRS-1.2` 위치 인자가 `["entries", "list"]`이고 개별 옵션이 `{ collection: "posts" }`로 분리된다

</details>

<details>
<summary><strong><code>CLI-PRS-2</code></strong> `--input`으로 JSON 문자열이나 표준 입력(`--input -`)을 넘겨 명령 입력 전체를 만든다</summary>

- **전제**: 객체 입력을 받는 Operation 명세와, JSON 문자열을 담은 `--input` 및 표준 입력(`-`)이 준비되어 있다
- **행동**: `--input '{"collection":"posts","status":"draft"}'`와 `--input -`(표준 입력에서 같은 JSON 읽기)로 각각 입력을 해석한다
- **결과**:
  - `CLI-PRS-2.1` 두 경우 모두 `{ collection: "posts", status: "draft" }` 객체를 돌려준다

</details>

<details>
<summary><strong><code>CLI-PRS-3</code></strong> `--key value`·`--flag` 옵션을 작업 명세의 타입(글자·숫자·참거짓)에 맞게 변환한다</summary>

- **전제**: 문자열(`key`), 숫자(`width`, `nullable` `anyOf` 포함), 불리언(`all`) 속성을 가진 Operation 명세가 있다
- **행동**: `{ key: "abc", width: "800", all: true }` 개별 플래그로 입력을 해석한다
- **결과**:
  - `CLI-PRS-3.1` 반환 객체가 `{ key: "abc", width: 800, all: true }`이다 (`width`는 숫자, `all`은 불리언)

</details>

<details>
<summary><strong><code>CLI-PRS-4</code></strong> `--help`로 전체 도움말과 특정 리소스·작업의 도움말을 만든다</summary>

- **전제**: `entries.list`와 `entries.create`를 포함한 `OperationSpec[]` 목록이 있다
- **행동**: 전체 도움말, `entries` 리소스 도움말, `entries.create` 작업 도움말을 각각 생성한다
- **결과**:
  - `CLI-PRS-4.1` 전체 도움말에 전역 옵션과 주요 명령(`migrate`, `spec`, `clean-files`)이 들어 있다
  - `CLI-PRS-4.2` 리소스 도움말에 `list`, `create` 작업 이름이 들어 있다
  - `CLI-PRS-4.3` 작업 도움말에 입력 속성 이름과 `--input`, `--dry-run`(쓰기 작업) 안내가 들어 있다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>CLI-PRS-5</code></strong> `--input`과 개별 `--key` 옵션을 함께 주면 거절한다</summary>

- **전제**: Operation 명세와 함께 `--input '{"collection":"posts"}'`와 개별 플래그 `--locale ko`가 동시에 주어졌다
- **행동**: 입력을 해석한다
- **결과**:
  - `CLI-PRS-5.1` 사용법 오류(`exitCode: 2`)를 던진다

</details>

<details>
<summary><strong><code>CLI-PRS-6</code></strong> `--input`의 JSON 문법이 틀리면 거절한다</summary>

- **전제**: `--input '{broken'`처럼 올바르지 않은 JSON 문자열이 주어졌다
- **행동**: 입력을 해석한다
- **결과**:
  - `CLI-PRS-6.1` 사용법 오류(`exitCode: 2`)를 던진다

</details>

<details>
<summary><strong><code>CLI-PRS-7</code></strong> 숫자 옵션에 숫자가 아닌 값을 주면 거절한다</summary>

- **전제**: 숫자(`number`/`integer`) 속성 `width`를 가진 Operation 명세에 `{ width: "abc" }`가 주어졌다
- **행동**: 입력을 해석한다
- **결과**:
  - `CLI-PRS-7.1` 사용법 오류(`exitCode: 2`)를 던진다

</details>

<details>
<summary><strong><code>CLI-PRS-8</code></strong> 값이 필요한 옵션 뒤에 값이 빠졌으면 거절한다</summary>

- **전제**: `--config`나 `--collection` 뒤에 값이 없이 인자 배열이 끝났다
- **행동**: 인자 배열을 파싱한다
- **결과**:
  - `CLI-PRS-8.1` 사용법 오류(`exitCode: 2`)를 던진다

</details>

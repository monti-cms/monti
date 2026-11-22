# `migrate/runner.ts` 인수 조건

[`docs/refactor/cli.md`](../../refactor/cli.md) 5.3절(운영 마이그레이션 적용과 상태 조회)의 인수 조건이다.

| 기능 | 하는 일 | 주요 거절 |
|---|---|---|
| `runMigrations` | 운영 설정(`config.dev !== true`)에서 내장 마이그레이션과 미적용 프로젝트 `.sql` 파일(`source = "project"`)을 이름순으로 실행한다(`dryRun: true`이면 미적용 내장·프로젝트 단계 전체를 한 트랜잭션으로 시험 실행 후 롤백) | `config.dev === true` 시 실행 오류(`exitCode: 1`), 실패한 SQL 파일 롤백·중단 |
| `getMigrationStatus` | DB를 변경하지 않고 `migrations` 테이블의 `source = "project"` 이력과 디렉터리의 `.sql` 파일을 대조해 적용 여부를 돌려준다 | 없음 |

---

## 1. 운영 마이그레이션 적용 (`runMigrations`)

### 핵심 요구사항

<details>
<summary><strong><code>CLI-MGR-1</code></strong> 내장 마이그레이션 뒤에 아직 적용하지 않은 프로젝트 SQL 파일을 이름 순서대로 적용한다</summary>

- **전제**: 비어 있는 DB, 코어 테이블을 참조하는 테이블을 만드는 플러그인, `config.dev`가 생략된 설정, 플러그인 테이블과 코어 `folders(id)`를 참조하는 `0001_init.sql`과 `posts_data`에 `subtitle` 열을 추가하는 `0002_add_subtitle.sql`이 있다
- **행동**: `runMigrations({ db, project, dir })`를 실행한다
- **결과**:
  - `CLI-MGR-1.1` 반환값이 `["0001_init.sql", "0002_add_subtitle.sql"]`이다
  - `CLI-MGR-1.2` `migrations` 테이블에 `("@monti-cms/core", "0001-initial")`, 플러그인 단계, `("project", "0001_init.sql")`, `("project", "0002_add_subtitle.sql")`이 모두 기록된다
  - `CLI-MGR-1.3` DB에 `posts` 테이블과 `posts_data.subtitle` 열이 존재한다

</details>

<details>
<summary><strong><code>CLI-MGR-2</code></strong> 이미 적용된 SQL 파일은 건너뛰고 새로 추가된 파일만 적용한다</summary>

- **전제**: `0001_init.sql`까지 적용된 DB와 `0001_init.sql`, `0002_add_subtitle.sql`이 있는 디렉터리 `dir`이 있다
- **행동**: `runMigrations({ db, project, dir })`를 실행한다
- **결과**:
  - `CLI-MGR-2.1` 반환값이 `["0002_add_subtitle.sql"]`이다
  - `CLI-MGR-2.2` `posts_data.subtitle` 열이 추가되어 있다
  - `CLI-MGR-2.3` `migrations` 테이블에 `("project", "0002_add_subtitle.sql")`이 기록된다

</details>

<details>
<summary><strong><code>CLI-MGR-3</code></strong> `--dry-run`은 빈 DB에서도 내장·프로젝트 마이그레이션을 시험 실행만 하고 변경을 남기지 않는다</summary>

- **전제**: 비어 있는 DB와, 코어 `folders(id)`를 참조해 `posts` 테이블을 만드는 `0001_init.sql` 및 그 테이블에 열을 추가하는 `0002_add_subtitle.sql`이 있다
- **행동**: `runMigrations({ db, project, dir, dryRun: true })`를 실행한다
- **결과**:
  - `CLI-MGR-3.1` 반환값이 `["0001_init.sql", "0002_add_subtitle.sql"]`이다
  - `CLI-MGR-3.2` DB에 `posts` 테이블이 없다
  - `CLI-MGR-3.3` DB에 `folders`와 `migrations` 테이블도 없다

</details>

<details>
<summary><strong><code>CLI-MGR-9</code></strong> 이미 일부 마이그레이션이 적용된 DB에서 `--dry-run`을 실행하면 이미 적용된 단계는 건너뛰고 새 파일만 시험 실행한 뒤 롤백한다</summary>

- **전제**: 코어 마이그레이션과 `0001_init.sql`까지 이미 적용된 DB와 `0001_init.sql`, `0002_add_subtitle.sql`이 있는 디렉터리 `dir`이 있다
- **행동**: `runMigrations({ db, project, dir, dryRun: true })`를 실행한다
- **결과**:
  - `CLI-MGR-9.1` 반환값이 `["0002_add_subtitle.sql"]`이다
  - `CLI-MGR-9.2` `posts_data` 테이블에 `subtitle` 열이 추가되지 않는다
  - `CLI-MGR-9.3` `migrations` 테이블에 `("project", "0002_add_subtitle.sql")`이 기록되지 않는다

</details>

### 경계 · 방어 검증

<details>
<summary><strong><code>CLI-MGR-4</code></strong> `--dry-run` 중 실행 오류가 나면 오류를 던지고 앞선 변경을 모두 롤백한다</summary>

- **전제**: 비어 있는 DB와 테이블을 만든 뒤 실행 오류(`SELECT 1 / 0`)가 이어지는 `.sql` 파일이 있다
- **행동**: `runMigrations({ db, project, dir, dryRun: true })`를 실행한다
- **결과**:
  - `CLI-MGR-4.1` 오류가 던져진다
  - `CLI-MGR-4.2` 그 SQL 파일이 만든 테이블과 `migrations` 테이블이 모두 없다

</details>

<details>
<summary><strong><code>CLI-MGR-5</code></strong> 중간 SQL 파일이 실패하면 해당 파일만 롤백하고 뒤 파일은 실행하지 않는다</summary>

- **전제**: 첫 번째 파일은 `step_one` 테이블을 만들고, 두 번째 파일은 `step_two` 테이블을 만든 뒤 SQL 오류로 실패하며, 세 번째 파일은 독립적으로 `step_three` 테이블을 만든다
- **행동**: `runMigrations({ db, project, dir })`를 실행한다
- **결과**:
  - `CLI-MGR-5.1` 오류가 던져진다
  - `CLI-MGR-5.2` `step_one` 테이블이 존재하고 `migrations`에 첫 번째 파일이 기록되어 있다
  - `CLI-MGR-5.3` `step_two`와 `step_three` 테이블이 없다
  - `CLI-MGR-5.4` `migrations`에 두 번째와 세 번째 파일이 기록되지 않는다

</details>

<details>
<summary><strong><code>CLI-MGR-6</code></strong> 개발 서버 설정으로는 운영 마이그레이션을 적용할 수 없다</summary>

- **전제**: 비어 있는 DB, `posts` 컬렉션이 정의된 스키마, `config.dev: true` 설정과 미적용 SQL 파일이 있다
- **행동**: `runMigrations({ db, project, dir })`를 실행한다
- **결과**:
  - `CLI-MGR-6.1` 실행 오류(`exitCode: 1`)를 던진다
  - `CLI-MGR-6.2` DB에 `posts` 테이블이 없다
  - `CLI-MGR-6.3` DB에 `migrations` 테이블이 없다

</details>

## 2. 마이그레이션 상태 조회 (`getMigrationStatus`)

### 핵심 요구사항

<details>
<summary><strong><code>CLI-MGR-7</code></strong> 아무것도 적용하지 않은 DB의 상태를 조회하면 테이블을 만들지 않고 모두 미적용으로 돌려준다</summary>

- **전제**: `migrations` 테이블이 없는 빈 DB와 `0001_init.sql`, `0002_add_subtitle.sql`이 있는 디렉터리 `dir`이 있다
- **행동**: `getMigrationStatus({ db, dir })`를 실행한다
- **결과**:
  - `CLI-MGR-7.1` 반환값이 `[{ name: "0001_init.sql", applied: false }, { name: "0002_add_subtitle.sql", applied: false }]`이다
  - `CLI-MGR-7.2` DB에 `migrations` 테이블이 생기지 않는다

</details>

<details>
<summary><strong><code>CLI-MGR-8</code></strong> 일부만 적용된 DB의 상태를 조회하면 프로젝트 출처의 적용 이력만 반영해 돌려준다</summary>

- **전제**: `("project", "0001_init.sql")`과 다른 출처 `("other-plugin", "0002_add_subtitle.sql")`이 `migrations`에 기록된 DB와 두 파일이 있는 디렉터리 `dir`이 있다
- **행동**: `getMigrationStatus({ db, dir })`를 실행한다
- **결과**:
  - `CLI-MGR-8.1` 반환값이 `[{ name: "0001_init.sql", applied: true }, { name: "0002_add_subtitle.sql", applied: false }]`이다

</details>

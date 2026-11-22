# `db/` 인수 조건

| 대상 | 하는 일 |
|---|---|
| `migrate` | 코어·플러그인 마이그레이션을 출처별(`(source, name)`)로 순서대로 실행하고 실패 시 해당 단계를 롤백한다 |
| `0001-initial` | 고정 도메인 테이블 8개(`templates`, `folders`, `media`, `media_uses`, `loose_files`, `admin`, `session`, `api_keys`)를 생성한다 |

---

## 1. 마이그레이션 실행기 (`migrate`)

<details>
<summary><strong><code>DB-MIG-1</code></strong> 마이그레이션 배열을 순서대로 실행한다</summary>

- **전제**: 마이그레이션 `second`, `first`가 배열에 순서대로 주어진다
- **행동**: `"@monti-cms/core"` 출처로 마이그레이션을 실행한다
- **결과**:
  - `DB-MIG-1.1` `second`, `first` 순서로 실행된다
  - `DB-MIG-1.2` `migrations`에 `("@monti-cms/core", "second")`, `("@monti-cms/core", "first")`가 기록된다

</details>

<details>
<summary><strong><code>DB-MIG-2</code></strong> 이미 실행된 마이그레이션은 건너뛰고 새 마이그레이션만 실행한다</summary>

- **전제**: `"@monti-cms/core"`의 `first` 마이그레이션이 이미 실행되어 있다
- **행동**: `first`, `second` 배열로 `"@monti-cms/core"` 마이그레이션을 실행한다
- **결과**:
  - `DB-MIG-2.1` `first`는 실행되지 않고 `second`만 실행된다
  - `DB-MIG-2.2` `migrations`에 `("@monti-cms/core", "first")`, `("@monti-cms/core", "second")`가 기록된다

</details>

<details>
<summary><strong><code>DB-MIG-3</code></strong> 마이그레이션이 중간에 실패하면 해당 마이그레이션을 롤백한다</summary>

- **전제**: 마이그레이션 3개가 배열에 순서대로 주어지고, 두 번째가 테이블을 만든 뒤 오류로 실패한다
- **행동**: `"@monti-cms/core"` 출처로 마이그레이션을 실행한다
- **결과**:
  - `DB-MIG-3.1` 첫 번째 마이그레이션이 만든 테이블이 남아 있고 `migrations`에 첫 번째가 기록된다
  - `DB-MIG-3.2` 두 번째 마이그레이션이 만든 테이블이 없다
  - `DB-MIG-3.3` `migrations`에 두 번째와 세 번째 마이그레이션이 기록되지 않는다
  - `DB-MIG-3.4` 세 번째 마이그레이션은 실행되지 않는다
  - `DB-MIG-3.5` 오류가 던져진다

</details>

<details>
<summary><strong><code>DB-MIG-4</code></strong> 코어와 플러그인의 마이그레이션 이력을 출처별로 구분해 기록한다</summary>

- **전제**: `"@monti-cms/core"`의 `init` 마이그레이션이 이미 실행되어 있다
- **행동**: 플러그인 `@monti-cms/ai`의 `init` 마이그레이션을 실행한다
- **결과**:
  - `DB-MIG-4.1` 플러그인 `@monti-cms/ai`의 `init`이 실행된다
  - `DB-MIG-4.2` `migrations`에 `("@monti-cms/core", "init")`과 `("@monti-cms/ai", "init")`이 모두 기록된다

</details>

## 2. 초기 스키마 (`0001-initial`)

<details>
<summary><strong><code>DB-SCH-1</code></strong> 첫 마이그레이션이 8개 고정 도메인 테이블을 만든다</summary>

- **전제**: 비어 있는 데이터베이스가 있다
- **행동**: `"@monti-cms/core"`의 첫 마이그레이션(`0001-initial`)을 실행한다
- **결과**:
  - `DB-SCH-1.1` `templates` 테이블에 `id`, `collection`, `name`, `content` 열이 있다
  - `DB-SCH-1.2` `folders` 테이블에 `id`, `scope`, `parent_id`, `name`, `trashed_at` 열이 있다
  - `DB-SCH-1.3` `media` 테이블에 `id`, `folder_id`, `key`, `filename`, `mime_type`, `size`, `width`, `height`, `trashed_at` 열이 있다
  - `DB-SCH-1.4` `media_uses` 테이블에 `media_id`, `source_kind`, `source_id`, `field_path` 열이 있다
  - `DB-SCH-1.5` `loose_files` 테이블에 `key`, `remove_after` 열이 있다
  - `DB-SCH-1.6` `admin` 테이블에 `id`, `email`, `password_hash` 열이 있다
  - `DB-SCH-1.7` `session` 테이블에 `token_hash`, `admin_id`, `expires_at` 열이 있다
  - `DB-SCH-1.8` `api_keys` 테이블에 `id`, `service`, `name`, `secret`, `last4` 열이 있다
  - `DB-SCH-1.9` `migrations`에 `("@monti-cms/core", "0001-initial")`이 기록된다

</details>

# @monti-cms/git-sync

[English](README.md) | 한국어

**발행한 글**을 GitHub 저장소의 파일과 양방향으로 동기화한다. 콘텐츠 전용 저장소도, 사이트 저장소(Astro, Hugo 등)의 `content` 폴더도 된다. 글을 발행하면 그 글의 파일이 커밋되고(또는 풀 리퀘스트가 열리고), 저장소에 push한 변경은 CMS로 돌아온다. 글이 양쪽에서 모두 바뀌었다면 아무것도 합치지 않는다. 관리자 화면이 diff와 함께 충돌을 보여 주고, 사람이 한쪽을 고른다.

- GitHub API와 토큰, 웹훅으로 통신하므로 서버리스에서도 돈다. 체크아웃도 `git` 실행 파일도 필요 없다.
- 코어의 이벤트 아웃박스(`afterCommit`)로 전달하므로, push가 실패해도 잃지 않고 재시도한다.
- 파일 본문은 형식 플러그인(기본 `mdx`)이 `purpose: "sync"`로 쓰므로, 쓴 것을 다시 읽을 수 있다.
- GitHub 토큰과 웹훅 비밀 값은 플러그인의 관리자 화면에서 저장하고, 서버 설정의 `secret`으로 암호화한다(`cms.secrets("git-sync")`). 설정 파일에는 두지 않는다.

```ts
// cms.config.ts
import { gitSync } from "@monti-cms/git-sync";
import { mdx } from "@monti-cms/mdx";

export default defineConfig({
	// …
	plugins: [
		mdx(),
		gitSync({
			targets: [
				{
					repo: "acme/site",
					branch: "main",
					folder: "content",
					collections: ["post", "memo"],
					path: "{collection}/{slug}.{locale}.{ext}",
					mode: "commit",
				},
			],
		}),
	],
});
```

그다음 `monti migrate`를 돌려(플러그인 저장소가 만들어진다) `/<관리자 경로>/git-sync`를 열고, 아래 "설정하기"를 따른다.

## 설정

`gitSync({ targets, enabled?, debounceMs?, client? })`

| 옵션 | 뜻 |
| --- | --- |
| `targets` | 글을 동기화할 곳(아래). 대상마다 따로 동기화한다 |
| `enabled` | `false`면 아무것도 등록하지 않는다(화면, 훅, 라우트 없음). 설정에 꺼 둔 채로 넣어 둘 수 있다. 기본 `true` |
| `debounceMs` | 마지막 커밋 뒤 이 밀리초 안에 들어온 발행은 큐(플러그인 저장소)에서 기다렸다가 한 커밋으로 나간다. 조용한 시간 뒤의 발행은 바로 커밋한다. `0`이면 발행마다 바로 커밋한다. 기본 `2000` |
| `client` | GitHub 클라이언트를 만든다(기본은 REST 클라이언트). 테스트나 다른 방식으로 GitHub에 닿는 호스트용이며 `@monti-cms/git-sync/testing`에 가짜가 있다. 서버 전용 |

대상:

| 옵션 | 뜻 |
| --- | --- |
| `repo` | GitHub 저장소 `owner/name` |
| `branch` | 동기화할 브랜치. 기본 `main` |
| `folder` | 파일을 둘 저장소 안의 폴더(`content`). 기본은 저장소 전체 |
| `format` | 파일을 쓰는 형식의 이름(`cms.formats()`). 가져오기(import)가 되어야 한다. 기본 `mdx` |
| `path` | `folder` 기준 파일 경로. 자리표시자: `{collection}`, `{slug}`, `{locale}`, `{id}`(글 id), `{ext}`(형식의 확장자). `{slug}`나 `{id}`가 있어야 하고, 컬렉션이 여럿이면 `{collection}`, 사이트 언어가 여럿이면 `{locale}`도 있어야 한다. 기본 `{collection}/{slug}.{locale}.{ext}`. Hugo 식 배치는 `{collection}/{slug}/index.{locale}.md` |
| `collections` | 발행한 글을 동기화할 컬렉션 |
| `mode` | `"commit"`(기본)은 브랜치에 바로 커밋한다. `"pr"`은 `prBranch`에 커밋하고 풀 리퀘스트를 열거나 갱신하며, 저장소가 자동 병합을 허용하면 검사가 통과한 뒤 스스로 병합된다 |
| `prBranch` | `"pr"` 방식이 쓰는 브랜치. 기본 `monti/publish` |
| `id` | 대상의 이름(저장되는 상태의 키). 기본은 `owner-name`이고 폴더가 있으면 뒤에 붙는다 |
| `apiUrl` | GitHub Enterprise Server의 REST API 주소(`https://git.example.com/api/v3`) |

설정은 사이트 설정을 만들 때 검사한다. 없는 컬렉션, 글을 구분하지 못하는 경로, git-sync가 쓰는 front matter 키(`slug`, `date`, `lastmod`, `monti`)와 이름이 같은 컬렉션 필드는 대상 이름과 함께 오류가 된다.

## 설정하기

1. **토큰.** GitHub에서 저장소의 *Contents*와 *Pull requests*에 **읽기·쓰기** 권한이 있는 세분화된 개인 액세스 토큰을 만든다(`repo` 범위의 클래식 토큰도 된다). Git 동기화 화면의 설정 탭에서 저장한다. 암호화해 저장하며 끝 네 글자만 보여 준다. 서버 설정에 `secret`(`CMS_SECRET`)이 있어야 하고, 없으면 아무것도 저장할 수 없다.
2. **웹훅**(변경을 돌려받으려면). 저장소의 Settings, Webhooks, Add webhook에서 Payload URL은 설정 탭이 보여 주는 주소(`https://<사이트>/api/cms/v1/git-sync/webhook`), 콘텐츠 형식은 `application/json`, 이벤트는 **push**만, 비밀 값은 설정 탭의 "만들기"로 만들어 저장한 뒤 같은 값을 GitHub에 붙여 넣는다. 라우트는 `X-Hub-Signature-256`을 그 비밀 값으로 검증하고, 맞지 않으면 거절한다. GitHub에서 사이트에 닿을 수 있어야 한다.
3. **첫 동기화.** `monti git-sync:push --all`이 발행한 글을 모두 저장소에 쓴다(아래).

웹훅이 없으면 화면의 "지금 가져오기"와 `monti git-sync:pull`(크론 작업용)로 변경을 가져온다.

## 파일

발행한 글 하나, 언어 하나에 파일 하나. YAML front matter, 빈 줄, 대상의 형식이 쓴 본문 순서다.

```
---
title: Hello world
summary: |-
  A short introduction
  on two lines.
tagIds:
  - 1f0c6a52-8d1e-4c7a-9f0b-2a3b4c5d6e7f
slug: hello-world
date: 2026-10-07T09:00:00.000Z
lastmod: 2026-10-08T10:30:00.000Z
monti:
  id: 8a3b5c1e-0d2f-4e6a-b7c8-9d0e1f2a3b4c
  collection: post
  locale: en
---

## Heading

A paragraph with **bold** and a [link to another post](/posts/another-post).
```

- 컬렉션의 **필드**(`title`, `summary`, 태그 등)는 저장된 그대로 최상위 키가 된다. **관계는 대상 글의 id**를 담는다(다대다는 id 목록). id는 대상의 주소가 바뀌어도 낡지 않고 그대로 왕복되지만 slug는 그렇지 않다. id가 어느 글인지 알려면 그 글 파일의 `monti.id`를 본다. 레코드 컬렉션(카테고리, 태그)의 언어별 이름은 중첩된 `translations` 매핑이다.
- `slug`, `date`(발행일), `lastmod`(수정일)는 정적 사이트 생성기가 읽는 키다. `date`와 `lastmod`는 사이트용으로 쓰기만 하고 **가져올 때는 무시**한다.
- `monti`는 글을 가리킨다. `id`, `collection`, `locale`, 번역이면 `translationOf`(원문 글의 id). 파일이 옮겨졌을 때 파일과 글을 짝짓는다.
- **본문**은 저장된 문서를 형식이 `purpose: "sync"`로 쓴 것이다. 내부 링크는 대상의 실제 경로로 쓰고(풀리지 않는 링크는 id를 유지한다), 이 텍스트를 가져오면 같은 문서가 돌아온다. 관리자 내보내기도 코어가 같은 방식으로 한다.

글을 파일로 쓰고 다시 가져오면 내용 해시가 같다. 필드, 관계, 코드 블록, 목록, 내부 링크로 테스트가 확인한다.

경로는 slug를 따른다(`path`가 그렇게 정한다). git에서 글 이름을 바꾸려면 front matter의 `slug`를 바꾼다. 그러면 파일 이름도 맞춰 바뀐다. `git mv`로 옮긴 파일은 `monti.id`로 글과 짝지어지고, 글의 주소가 말하는 자리로 되돌려진다.

## 내보내기: CMS에서 저장소로

동기화하는 컬렉션의 `afterCommit` 이벤트가 글을 큐(플러그인 저장소, 글과 대상마다 한 항목)에 넣고, 큐는 git 데이터 API(blob, tree, commit, ref 갱신)로 커밋된다. 글은 이벤트가 본 때가 아니라 **지금 상태**로 읽으므로, 반복되거나 늦게 도착한 이벤트도 해롭지 않다.

| 변경 | 결과 |
| --- | --- |
| 발행(복원 포함) | 파일을 쓰거나 갱신한다 |
| 발행된 slug가 바뀜 | 파일 이름을 바꾼다(같은 커밋에서 옛 경로를 지운다) |
| 발행 취소, 보관, 휴지통, 삭제 | 파일을 지운다 |
| 저장(임시 저장) | 아무것도 하지 않는다. 파일에는 발행된 버전이 있다 |

- **묶기.** 조용한 시간(`debounceMs`) 뒤 첫 발행은 바로 커밋된다. 그 창 안에서 이어지는 발행은 큐에 쌓였다가 창이 끝나면 한 커밋으로 나간다. 서버리스에서는 백그라운드로 도는 것이 없으므로, 창은 아웃박스가 재시도할 때 끝난다(다음 쓰기, `monti events:retry`, 크론. 계속 떠 있는 프로세스는 스스로 비운다). 커밋 메시지에 들어 있는 항목이 적힌다.
- **`"pr"` 방식.** 커밋은 `prBranch`로 간다. 그 브랜치에서 열린 풀 리퀘스트가 있으면 거기에 더하고, 없으면 브랜치를 `branch`의 끝에서 다시 시작해 새 풀 리퀘스트를 연다. 저장소가 허용하면 자동 병합을 켠다(아니면 화면이 풀 리퀘스트가 병합을 기다린다고 알려 준다).
- **기록.** 글마다 파일 경로, git-sync가 마지막으로 쓴 git blob sha, 발행된 글의 내용 해시를 플러그인 저장소에 둔다. 해시 불일치와 "할 일 없음"을 가르는 기준이다.
- **실패는 예외로 던진다.** 그래서 아웃박스가 재시도한다(15초부터 두 배씩, 기본 8번, 그 뒤엔 이벤트 화면의 dead letter). 그동안 큐가 글을 쥐고 있고, "대기열 지금 커밋"이나 다음 발행이 내보낸다.
- 열린 충돌이 있는 글은 충돌이 결정될 때까지 push하지 않는다.

## 가져오기: 저장소에서 CMS로

대상 브랜치로의 push(웹훅), "지금 가져오기", `monti git-sync:pull`은 같은 가져오기를 돌린다. 브랜치 끝에서 폴더의 파일을 기록과 비교하고, git-sync가 쓴(또는 읽은) blob 그대로인 파일은 건너뛴다. 바뀌었거나 새 파일이면 다음과 같이 한다.

1. 파일을 형식으로 읽어 글로 만든다(필드는 front matter, 본문은 형식). 글은 그 경로로 동기화된 글, 없으면 `monti.id`가 가리키는 글, 없으면 같은 주소의 발행된 글이고, 모두 없으면 새로 만든다(번역은 원문에서, `monti.translationOf`).
2. **관리자에서 고치는 것과 같은 파이프라인**(`cms.contentService()`: 훅, 검증, 참조, 링크·미디어 정규화)으로 쓰고 **발행**한다. 반영하지 못한 파일은 가져오기 결과의 `errors`에(코드와 파이프라인이 찾은 문제) 적히며 다른 파일을 막지 않는다.
3. 이 때문에 생긴 발행은 저장소로 다시 커밋하지 않는다. 파일이 이미 글과 같다.

git에서 파일을 지워도 글은 발행 취소되지 않는다(발행 취소는 CMS에서 한다). 그 글을 다음에 발행하면 파일이 다시 쓰인다.

## 충돌

다음 경우 글을 **쓰지 않고** 충돌을 기록한다.

- 마지막 동기화 뒤 양쪽이 모두 바뀜. 발행된 글의 내용 해시(또는 slug)가 기록과 다르고 파일의 blob도 다르다(`both-changed`)
- 서버에 발행하지 않은 수정이 있어, 가져오면 그것을 덮어쓰게 됨(`unpublished-changes`)
- git에 다른 내용의 파일이 이미 있는데 글이 한 번도 동기화된 적이 없음(`unsynced`). 파일이 이미 있는 저장소에 `push --all`을 하면 만나는 경우다
- 서버에서 글을 발행 취소하거나 삭제했는데 그 파일이 git에서 수정됨(`git-edit-blocks-removal`)

반대 방향도 같은 검사로 지킨다. 발행이 git에서 수정된 파일을 덮어쓰거나 지우는 일은 없고, 대신 충돌이 기록된다.

**충돌** 탭은 **서버 텍스트**와 **git 텍스트**(둘 다 형식이 쓴 것)를 줄 단위 diff로 보여 준다. 동작은 둘이고, 아무것도 조용히 합치지 않는다.

- **Git 버전 사용**: git 텍스트를 파이프라인으로 글에 쓰고 발행해, 서버에 있던 것(발행하지 않은 임시 저장 포함)을 대체한다. 휴지통이나 보관함의 글은 돌아온다.
- **서버 버전 사용**: 서버에 있는 글을 git의 파일 위에 push한다(커밋 또는 풀 리퀘스트). 글이 더는 발행 상태가 아니면 파일을 지운다.

결정은 사람이 본 파일 기준으로 한다(blob sha를 함께 보낸다). 그 사이 파일이 또 바뀌었으면 결정은 거절되고 화면에 새 텍스트가 나온다. 파일이 마지막으로 동기화한 내용으로 되돌려지면 충돌은 스스로 풀린다. 더는 결정할 것이 없고, 그 사이 서버에서 바뀐 것은 다음 flush로 나간다.

## 첫 동기화

```sh
monti git-sync:push --all [--target <id>]
```

대상 컬렉션의 발행한 글을 모두 한 커밋으로 쓴다(`"pr"` 방식이면 풀 리퀘스트). 이미 같은 내용인 파일은 그대로 두고, 다른 내용이면 충돌이 된다. 플러그인을 설정할 때 한 번 돌린다.

## 명령

모두 `monti migrate`처럼 앱을 불러온다(`--env-file`, `--no-env-file`, `--server`).

| 명령 | 하는 일 |
| --- | --- |
| `monti git-sync:pull [--target <id>]` | 웹훅처럼 가져온다. 반영하지 못한 파일이 있으면 종료 코드 1 |
| `monti git-sync:push --all [--target <id>]` | 첫 동기화 |
| `monti git-sync:flush [--target <id>]` | 묶음 큐를 지금 커밋한다 |

## 관리자 화면

`/<관리자 경로>/git-sync`(사이드바 항목 "Git 동기화"):

- **동기화**: 대상별 저장소와 브랜치, 방식, 폴더, 경로 패턴, 형식, 컬렉션. 동기화된 글, 큐에서 기다리는 글, 충돌 중인 글의 수. 마지막 가져오기(개수, 오류 파일, 건너뛴 파일)와 마지막 커밋(파일 수, 커밋, 풀 리퀘스트 링크, 알림). **지금 가져오기**와 **대기열 지금 커밋**
- **충돌**: diff와 두 동작이 있는 목록. 탭에 개수가 표시된다
- **설정**: GitHub 토큰과 웹훅 비밀 값(쓰기 전용), 웹훅 Payload URL

## API

`/api/cms/v1/git-sync/` 아래에 있고, 웹훅만 공개(서명 검증)이며 나머지는 관리자 전용이다.

| 라우트 | |
| --- | --- |
| `GET status`, `GET/PUT settings` | 화면의 데이터. 토큰과 비밀 값은 쓰기만 된다 |
| `POST pull`, `POST flush` | `{ target? }`: "지금 가져오기"와 "대기열 지금 커밋" |
| `GET conflicts`, `POST conflicts/resolve` | `{ target, entryId, resolution: "git" \| "server", gitSha? }` |
| `POST webhook` | GitHub push 웹훅(`X-Hub-Signature-256`, `X-GitHub-Event`) |

## 이것을 쓰는 사이트 테스트

```ts
import { createFakeGitHub, pushPayload, webhookSignature } from "@monti-cms/git-sync/testing";

const github = createFakeGitHub();
const repo = github.repo("acme/site", { main: { "README.md": "# site\n" } });
// gitSync({ client: github.factory, targets: [...] })
repo.files("main"); // 경로 → 텍스트
repo.commit("main", [{ path: "content/post/a.en.mdx", text: "..." }]); // git에서 고친 것
repo.merge(1); // 열린 풀 리퀘스트를 병합
github.failNext("createCommit"); // 재시도 테스트를 위한 GitHub 실패
```

## 알아 둘 선택

- **발행한** 글만 동기화한다. 임시 저장은 동기화하지 않는다(초안 브랜치 흐름은 별도 단계다).
- 파일에는 **발행된** 버전이 있다. 관계는 id이고, 경로는 slug에서 정해진다.
- 가져오기는 커밋이 아니라 blob(git에 있는 것)과 기록(git-sync가 마지막으로 쓴 것)을 비교한다. 그래서 웹훅 한 번이 몇 번의 push를 담는지는 상관없고, 놓친 웹훅은 다음 가져오기가 메운다.
- 대상마다 한 번에 하나의 flush나 pull만 돈다. 프로세스가 달라도 그렇다(플러그인 저장소의 만료되는 잠금).
- 병합 없이 닫힌 풀 리퀘스트는 브랜치에 옛 파일을 남긴다. 그 글이 들어 있는 다음 flush(그 글의 발행, 그 이벤트의 재시도, `monti git-sync:push --all`)가 그 버전을 새 풀 리퀘스트에 담는다.
- 미디어 파일은 동기화하지 않는다. 본문의 이미지는 미디어 id를 유지한다(`purpose: "sync"`).

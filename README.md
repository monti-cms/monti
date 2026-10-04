# Monti

개발 블로그를 위한 CMS.

이름은 몽테뉴(Montaigne)를 줄인 것이다. 이탈리아어로 "산들"이라는 뜻이기도 하다.

## 패키지

| 패키지 | 하는 일 |
| --- | --- |
| [`@monti-cms/core`](packages/core) | 본체. 설정, 글 저장·발행, MDX 변환, 관리자 API, 명령줄(`monti`) |
| [`@monti-cms/admin`](packages/admin) | 관리자 화면. 편집기, 글 목록, 미디어, 템플릿 |
| [`@monti-cms/blocks`](packages/blocks) | 블록 확장. 콜아웃, 접기, 탭, 단 나누기, Mermaid, 차트 |
| [`@monti-cms/ai`](packages/ai) | AI 확장. 글쓰기·번역 같은 AI 기능 |
| [`@monti-cms/seo`](packages/seo) | SEO 확장. 검색·공유 필드와 미리보기 |
| [`@monti-cms/bareun`](packages/bareun) | 바른(Bareun) 맞춤법 검사 |

## 설치

아직 npm에 올리지 않았다. 공개 전에는 `release` 브랜치의 배포 묶음을 GitHub 주소로 설치한다(pnpm만 된다).

```json
{
	"dependencies": {
		"@monti-cms/core": "github:monti-cms/monti#release/v0.1.0&path:/core",
		"@monti-cms/admin": "github:monti-cms/monti#release/v0.1.0&path:/admin"
	}
}
```

다른 패키지도 `path:/<폴더 이름>`만 바꿔 같은 태그로 넣는다. 저장소가 비공개라 설치하는 곳(로컬·배포 서버)에서 이 저장소를 읽을 수 있어야 한다.

설치 방법과 설정은 각 패키지의 README에 있다. 모두 붙인 예시 앱은 [`examples/other-site`](examples/other-site)다.

## 개발

```sh
pnpm install          # 설치
pnpm lint             # 코드 검사 (고치려면 pnpm lint:fix)
pnpm check:korean     # 실행 코드의 한국어 문구가 문구 사전에만 있는지 검사
pnpm typecheck        # 모든 패키지 타입 검사
pnpm build            # 모든 패키지 빌드 (core → admin → ai → blocks → bareun → seo)
pnpm test:run         # 테스트 (Postgres 필요)
pnpm example:check    # 패키지를 묶어 예시 앱에 설치하고 빌드까지 확인
```

테스트는 `.env.local`에 테스트용 DB 주소(`CMS_TEST_DATABASE_URL`)가 있어야 전부 돈다. 테스트는 이 DB에 임시 스키마를 만들고 끝나면 지운다.

## 버전 내기

```sh
node scripts/version.mjs 0.1.0   # 모든 패키지 버전을 한 번에 바꾼다
git commit -am "v0.1.0"
git tag v0.1.0 && git push origin main v0.1.0
```

`v*` 태그가 올라가면 배포 워크플로(`.github/workflows/release.yml`)가 패키지를 빌드·묶어 `release` 브랜치에 커밋하고 `release/v0.1.0` 태그를 붙인다.

# @monti-cms/blocks

Monti의 블록과 서식을 사이트가 복사해 가져가 고쳐 쓰는 소스로 내놓는다: 콜아웃, 탭, 단 나누기, 접기, 코드 탐색기, 수식, Mermaid 다이어그램,
차트, 툴팁, 글자 색(설계: `docs/design/features/18-blocks-package.md`).

사이트는 이 패키지를 가져오지(import) 않는다. 설치한 뒤 원하는 것을 더한다:

```sh
pnpm add -D @monti-cms/blocks
pnpm monti add callout math
```

`monti add`는 블록마다 그 폴더를 사이트의 `monti/blocks/`에 복사하고, 처음 더할 때 사이트를 잇는다: `monti.config.ts`에 `blocks`와 `marks`,
관리자 페이지에 블록, 사이트의 맨 위 레이아웃에 `blocks.css`, `renderDocument`를 부르는 곳에 `blocks`와 `marks`. 이미 있는 폴더는 덮지 않는다.
사이트가 고쳤을 수 있어서다. 이름 없이 `monti add`를 부르면 더할 수 있는 것을 보인다.

| 이름 | 무엇 | 설치할 것 |
|---|---|---|
| `callout` | 노트, 팁, 정보, 경고, 위험을 담는 상자 | |
| `tabs` | 같은 것을 몇 가지로, 한 번에 하나씩 | |
| `columns` | 블록을 나란히 | |
| `collapsible` | 제목을 눌러 여는 부분 | |
| `code-explorer` | 프로젝트의 파일을 나무와 코드로 | |
| `math` | LaTeX 수식, 서버에서 KaTeX가 그린다 | `katex` |
| `mermaid` | Mermaid 다이어그램, 읽는 사람의 브라우저가 그린다 | `mermaid` |
| `chart` | 표의 숫자를 막대, 선, 영역, 원으로 | |
| `tooltip` (서식) | 몇 글자에 붙는 설명 | |
| `color` (서식) | 색 있는 글자, 색 바탕의 글자 | |

블록이 독자에게 보이는 말(콜아웃의 종류, "펼치기")은 그 블록의 `site.tsx`에 영어, 한국어, 일본어로 있고, 사이트가 `renderDocument`에 넘긴 글의
`locale`로 고른다. 모양은 그 블록의 `.css` 파일이고 `base.css`의 변수를 쓴다.

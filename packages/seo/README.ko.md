# @monti-cms/seo

[English](README.md) | 한국어

Monti의 SEO 플러그인입니다. 검색과 공유 필드를 제 탭에 두고, 편집기에서 미리 보이고, 사이트 페이지는 `seoOf`로 값을 읽습니다.

```ts
// monti.config.ts
import { defineConfig } from "@monti-cms/core";
import { seo } from "@monti-cms/seo";

export default defineConfig({
	// …
	plugins: [seo()],
});
```

```tsx
// app/admin/page.tsx
import { AdminPage } from "@monti-cms/next/admin";
import { seoAdmin } from "@monti-cms/seo/admin";

export default function Page() {
	return <AdminPage plugins={[seoAdmin]} />;
}
```

앞의 것은 플러그인의 서버 쪽 절반이고, 뒤의 것은 브라우저 쪽 절반(입력과 미리보기)입니다. 뒤의 것이 없어도 필드는 있고 종류의 기본 입력으로
그려집니다. 미리보기는 없습니다.

## 더하는 것

문서 컬렉션마다 속성 패널에 "SEO" 탭이 생깁니다. 탭은 플러그인의 것입니다. 설정에서는 잠겨 보이고, 필드는 `monti.schema.ts`에 적히지
않습니다. 플러그인을 빼면 탭도 빠지고, 값은 글에 남습니다.

| 필드 | 이름 | 무엇인가 |
|---|---|---|
| 미리보기 | `seoPreview` | 검색 결과와 공유 링크에서 글이 보이는 모습. 값이 없습니다 |
| SEO 제목 | `seoTitle` | 글자, 언어마다. 비면 사이트는 글의 제목을 쓰고, 칸이 그 길이와 함께 알립니다("제목과 같음 · 10/60") |
| SEO 설명 | `seoDescription` | 글자, 언어마다. 비면 사이트는 `summary` 필드를 씁니다 |
| 공유 이미지 | `seoImage` | 그림. 비면 사이트는 `cover` 필드를 씁니다 |
| 검색에서 숨기기 | `seoNoindex` | 스위치. `noindex`이거나 값이 없습니다 |
| 대표 주소 | `seoCanonical` | 이 글이 되풀이하는 원래 페이지의 주소 |

- 적은 제목과 설명 옆의 글자 수는 권장 길이(60, 160)를 넘으면 경고 색이 됩니다. 막지는 않습니다.
- 목록은 SEO 제목, SEO 설명, 공유 이미지를 열로 보일 수 있고("열 추가"), 열마다 "비어 있음"으로 거릅니다.
- 사이트 스키마에 같은 이름의 필드가 있으면 그 필드가 플러그인의 것 대신 섭니다.

## 옵션

```ts
seo({
	collections: ["post"], // 탭이 생길 문서 컬렉션. 없으면 모두
	language: "en", // 필드 이름의 언어. 없으면 관리자 화면처럼 한국어
	limits: { title: 70, description: 155 }, // 글자 수가 경고하는 권장 길이
	follows: { description: "lead", image: "hero" }, // 빈 값이 따르는 사이트의 필드
});
```

## 사이트 페이지에서

```ts
import { seoOf } from "@monti-cms/seo";

export async function generateMetadata({ params }) {
	const found = await reader.entry({ collection: "post", slug: (await params).slug, locale: "en" });
	if (!found || !("entry" in found)) return {};
	const seo = seoOf(found.entry);
	return {
		title: seo.title,
		description: seo.description,
		alternates: seo.canonical ? { canonical: seo.canonical } : undefined,
		robots: seo.noindex ? { index: false } : undefined,
		openGraph: seo.image ? { images: [{ url: seo.image.src, width: seo.image.width, height: seo.image.height }] } : undefined,
	};
}
```

`seoOf(entry, follows?)`는 제목(적지 않았으면 글의 제목), 설명, 공유 이미지, 대표 주소(있을 때), `noindex`를 돌려줍니다. 플러그인에
`follows`를 줬다면 같은 값을 줍니다.

## 개발

```sh
pnpm --filter @monti-cms/seo test
pnpm --filter @monti-cms/seo typecheck
```

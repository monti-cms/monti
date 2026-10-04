import type { CmsServerPlugin } from "@monti-cms/core";

/**
 * 브라우저 묶음의 `@monti-cms/ai/server`. 사이트 설정은 브라우저에서도 읽혀 서버 쪽을 불러오는 코드가 함께 묶이는데,
 * 서버 코드(AI SDK·DB)를 브라우저로 보내지 않도록 이 빈 진입점으로 바꾼다(package.json `exports`의 `browser` 조건).
 */
const empty: CmsServerPlugin = {};

export default empty;

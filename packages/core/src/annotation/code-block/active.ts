// 이름표(`label`)가 화면 언어를 알도록 사전 언어를 먼저 정한다.
import "../../i18n";
import { cmsConfig } from "../../config/resolved";
import { createAnnotationConfig } from "./constants";
import { resolveCodeLineEffects } from "./line-effects";
import { ANCHOR, COLLAPSE, type CodeLineEffectName } from "./model";

/** 사이트가 쓰는 줄 효과(본체 기본 + 사이트 설정의 `codeBlock.lineEffects`). 편집기 메뉴 순서다. */
export const CODE_LINE_EFFECTS = resolveCodeLineEffects(cmsConfig.codeBlock?.lineEffects);

/** 사이트가 쓰는 코드 펜스 주석 설정. 저장 문법 변환과 공개 렌더러(`remarkAnnotationToShikiDecoration`)가 쓴다. */
export const annotationConfig = createAnnotationConfig(CODE_LINE_EFFECTS);

/** 줄 효과 정의. 모르는 이름이면 `undefined`다. */
export const lineEffectDefinition = (name: string) => CODE_LINE_EFFECTS.find((effect) => effect.name === name);

/** 편집기가 아는 줄 효과 이름인가(정의 목록의 효과와 줄 접기·본문 연결 이름표). */
export const isLineEffectName = (name: string): name is CodeLineEffectName =>
	name === COLLAPSE || name === ANCHOR || CODE_LINE_EFFECTS.some((effect) => effect.name === name);

// 이름표(`block.label`)가 화면 언어를 알도록 사전 언어를 먼저 정한다.
import "../i18n";
import { cmsConfig } from "../config/resolved";
import type { BlockDefinition } from "./define";
import { addedBlocks, resolveBlocks } from "./resolve";

/** 사이트가 쓰는 본문 블록(본체 블록 + 플러그인과 사이트 설정이 더한 블록). 저장 문법 표·검사·편집기·`/meta`가 읽는다. */
export const BLOCKS: readonly BlockDefinition[] = resolveBlocks(cmsConfig);

const ACTIVE = new Set(BLOCKS.map((block) => block.name));

/** 이 블록을 쓰는가(설치했는가). */
export const isBlockActive = (name: string): boolean => ACTIVE.has(name);

/** 더한 블록(블록 확장 플러그인과 사이트 설정의 `blocks`). 편집기는 이 정의에서 노드를 만든다. */
export const ADDED_BLOCKS: readonly BlockDefinition[] = addedBlocks(cmsConfig).map(({ block }) => block);

/** 더한 글자 꾸밈(`syntax.kind: "text"`, `editor.view: "mark"`). 더한 순서가 겹친 꾸밈을 저장하는 순서다. */
export const ADDED_MARK_BLOCKS: readonly BlockDefinition[] = ADDED_BLOCKS.filter(
	(block) => block.syntax.kind === "text",
);

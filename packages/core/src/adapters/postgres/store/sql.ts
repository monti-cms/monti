/** `LIKE` 패턴 안에서 글자 그대로 찾게 할 `%`·`_`·`\`를 이스케이프한다(Postgres 기본 이스케이프 문자 `\`). */
const escapeLikeText = (value: string): string => value.replace(/[%_\\]/g, "\\$&");

/** "이 글자를 포함한다" 패턴. 값은 반드시 바인딩 인자로 넘긴다. */
export const likeContainsPattern = (value: string): string => `%${escapeLikeText(value)}%`;

/** "이 글자로 시작한다" 패턴. 값은 반드시 바인딩 인자로 넘긴다. */
export const likePrefixPattern = (value: string): string => `${escapeLikeText(value)}%`;

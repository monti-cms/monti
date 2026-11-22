import { MontiError } from "../../engine/errors";
import type { CollectionSchema, ReadContext } from "../../engine/types";

/** 컬렉션의 스키마. 스키마에 없는 이름이면 거절한다: 컬렉션 테이블 이름은 이 검사를 거친 것만 쓴다. */
export function collectionOf(ctx: ReadContext, name: string): CollectionSchema {
	if (!Object.hasOwn(ctx.schema.collections, name)) {
		throw new MontiError("BAD_REQUEST", `"${name}" 컬렉션이 없다`);
	}
	return ctx.schema.collections[name];
}

/** 스키마의 `locales`에 없는 언어 코드를 거절한다. */
export function rejectLocale(ctx: ReadContext, locale: string): void {
	if (!ctx.schema.locales.includes(locale)) throw new MontiError("BAD_REQUEST", `"${locale}" 언어가 없다`);
}

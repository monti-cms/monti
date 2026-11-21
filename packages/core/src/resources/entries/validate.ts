import { MontiError } from "../../engine/errors";
import type { CollectionSchema, ReadContext, WriteContext } from "../../engine/types";
import { docOf } from "../_shared/doc";
import { isActiveFolder } from "../folders/folders";
import { bodyReferences, referencesIn, rejectInactive } from "./active";
import { fieldsSchema } from "./fields";
import { tablesOf } from "./tables";
import type { EntryData, Status } from "./types";

/** 쓰기가 받는 필드 값과 본문. `fields`를 생략하면 필드가 없다. */
export interface DataInput {
	fields?: Record<string, unknown>;
	body?: unknown;
}

/** 슬러그의 주인: 같은 컬렉션·언어·상태의 활성 글끼리 겹칠 수 없다. `id`는 그 글 자신이라 빼고 본다. */
interface SlugOwner {
	id: string;
	locale: string;
	slug: string | null;
}

/** 컬렉션 `name`의 활성 폴더가 아니면 거절한다. */
export async function rejectFolder(ctx: ReadContext, folderId: string, name: string): Promise<void> {
	if (!(await isActiveFolder(ctx, folderId, name))) {
		throw new MontiError("BAD_REQUEST", "이 컬렉션의 활성 폴더가 아니다");
	}
}

/** 같은 컬렉션·언어·`status`의 다른 활성 글이 같은 슬러그를 쓰면 거절한다. 빈 슬러그(`null`)는 겹치지 않는다. */
export async function rejectTakenSlug(ctx: ReadContext, name: string, owner: SlugOwner, status: Status) {
	if (owner.slug === null) return;
	const taken = await tablesOf(ctx.db)
		.selectFrom(`${name}_data as d`)
		.innerJoin(`${name} as e`, "e.id", "d.entry_id")
		.select("d.entry_id")
		.where("d.entry_id", "<>", owner.id)
		.where("e.trashed_at", "is", null)
		.where("d.locale", "=", owner.locale)
		.where("d.status", "=", status)
		.where("d.slug", "=", owner.slug)
		.executeTakeFirst();
	if (taken !== undefined) throw new MontiError("CONFLICT", "같은 컬렉션과 언어의 다른 글이 이 슬러그를 쓴다");
}

/** 본문이 있으면 컬렉션이 본문을 쓰는지와 본문 형식을 검사한다. */
function checkBody(ctx: ReadContext, collection: CollectionSchema, body: unknown) {
	if (body === undefined) return undefined;
	if (collection.body !== true) throw new MontiError("BAD_REQUEST", "이 컬렉션은 본문을 쓰지 않는다");
	return docOf(body, ctx);
}

/**
 * 저장할 `{ fields, body? }`. 스키마에 없는 키, 필드 타입·제약에 어긋난 값, 살아 있지 않은 미디어나 관계 대상을
 * 가리키는 필드, 쓰지 않는 본문, 형식이 틀린 본문, 살아 있지 않은 미디어를 참조하는 본문을 거절한다.
 */
export async function checkData(ctx: WriteContext, collection: CollectionSchema, data: DataInput): Promise<EntryData> {
	const parsed = fieldsSchema(collection.fields).safeParse(data.fields ?? {});
	if (!parsed.success) throw new MontiError("BAD_REQUEST", "필드가 컬렉션과 맞지 않는다", parsed.error.issues);
	const fields = parsed.data as Record<string, unknown>;
	const body = checkBody(ctx, collection, data.body);
	await rejectInactive(ctx, bodyReferences(body, referencesIn(collection, fields)));
	return body === undefined ? { fields } : { fields, body };
}

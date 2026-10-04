import type { CollectionSchema } from "./collection";
import type { FieldRole, ValueField } from "./fields";

/**
 * 컬렉션 정의 하나를 읽는 순수 함수. 사이트 설정(`config/resolved.ts`)을 읽지 않으므로 설정 파일이 import하는 확장
 * (예: 확장의 필드 검사·공개 화면 도우미)과 `defineConfig`가 쓴다. 설정에서 이름으로 찾는 함수는 `derive.ts`다.
 */

/** 메타데이터에 값 하나로 저장되는 필드. 조건부 필드의 선택 값과 딸린 필드도 각각 하나로 펼친다. */
export interface StoredField {
	readonly name: string;
	readonly field: ValueField;
	/** 조건부 필드에 딸린 필드면 그 조건. 조건이 맞을 때만 값을 남긴다. */
	readonly when?: { readonly field: string; readonly value: string };
}

/** 저장 필드 목록. 선언 순서를 따르고 조건부 필드에 딸린 필드는 그 필드 바로 뒤에 온다. */
export function valueFieldsOf(schema: Pick<CollectionSchema, "fields">): StoredField[] {
	const result: StoredField[] = [];
	for (const [name, field] of Object.entries(schema.fields)) {
		// 주소는 콘텐츠 열에, 반대 방향 관계는 상대 레코드에 저장한다. 보기 필드는 저장하지 않는다.
		if (field.kind === "slug" || field.kind === "backlink" || field.kind === "view") continue;
		if (field.kind === "conditional") {
			result.push({ name, field: field.discriminant });
			for (const [value, group] of Object.entries(field.values)) {
				for (const [nestedName, nested] of Object.entries(group ?? {})) {
					result.push({ name: nestedName, field: nested, when: { field: name, value } });
				}
			}
			continue;
		}
		result.push({ name, field });
	}
	return result;
}

/** 그 역할(`role`)을 가진 저장 필드. 없으면 `undefined`. */
export function fieldWithRole(schema: Pick<CollectionSchema, "fields">, role: FieldRole): StoredField | undefined {
	return valueFieldsOf(schema).find((stored) => stored.field.role === role);
}

/** 그 역할 필드의 값(문자열). 필드가 없거나 값이 문자열이 아니면 `""`. */
export function valueWithRole(
	schema: Pick<CollectionSchema, "fields">,
	role: FieldRole,
	values: { readonly [key: string]: unknown },
): string {
	const stored = fieldWithRole(schema, role);
	const value = stored ? values[stored.name] : undefined;
	return typeof value === "string" ? value : "";
}

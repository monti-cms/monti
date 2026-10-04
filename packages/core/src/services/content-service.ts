import { isCollection, isItemCollection } from "../core/collections";
import { isLocale } from "../core/locales";
import { prepareSnapshot, SERVICE_INPUT_KEYS, validateExactRecord } from "../core/snapshot";
import { withTranslationHints } from "../core/translation/hints";
import { slugFromValues } from "../schema/derive";
import { type SaveDraftInput, ServiceError, type ServiceInput, type StorePort } from "./types";

// 스냅샷 규칙은 도메인 계층(`core/snapshot`)에 있다. 기존 import 경로를 위해 다시 내보낸다.
export { imageWarningsForPublish, prepareSnapshot, validateForPublish } from "../core/snapshot";

const assertInputKeys = (input: unknown, baseKeys: readonly string[]) => {
	if (!input || typeof input !== "object" || Array.isArray(input)) throw new ServiceError("invalid_input");
	const withFolder = (input as { folderId?: unknown }).folderId !== undefined;
	validateExactRecord(input, withFolder ? [...baseKeys, "folderId"] : baseKeys);
};

/**
 * record 컬렉션(§5.2)은 이름만 입력해도 만들 수 있어야 한다. slug가 비면 주소 필드의 `from`이 가리키는 값에서
 * 만든다(`from`이 없으면 만들지 않는다). 명시적 저장이 곧 공개 반영이라 slug 없는 레코드는 존재할 수 없다.
 */
const withRecordSlug = (input: ServiceInput): ServiceInput => {
	if (!isItemCollection(input.collection) || input.slug?.trim()) return input;
	const slug = slugFromValues(input.collection, input.metadata ?? {});
	return slug ? { ...input, slug } : input;
};

export const createContentService = <T = unknown>(storePort: StorePort<T>) => ({
	/**
	 * 새 콘텐츠를 만든다. record 컬렉션은 기본으로 곧바로 공개한다(`publishImmediately` 생략 시).
	 */
	createDraft: async (input: ServiceInput, options?: { publishImmediately?: boolean }) => {
		assertInputKeys(input, SERVICE_INPUT_KEYS);
		const { folderId, ...rest } = withRecordSlug(input);
		const snapshot = await prepareSnapshot(rest as ServiceInput);
		return storePort.createEntryWithReferences({
			snapshot,
			references: snapshot.references,
			folderId,
			publishImmediately: options?.publishImmediately ?? isItemCollection(input.collection),
		});
	},

	/**
	 * 최신 초안을 저장한다. record 컬렉션은 기본으로 저장과 함께 공개 값에 반영한다.
	 */
	saveDraft: async (entryId: string, input: SaveDraftInput, options?: { publishImmediately?: boolean }) => {
		assertInputKeys(input, [
			...SERVICE_INPUT_KEYS,
			"expectedVersion",
			// 들어온 값이 객체가 아니면 `assertInputKeys`가 거부한다. 속성 읽기(접근자)는 그 뒤에만 한다.
			...(input && typeof input === "object" && Object.hasOwn(input, "translation") ? ["translation"] : []),
		]);
		const { expectedVersion, folderId, ...rest } = input;
		if (typeof expectedVersion !== "number" || expectedVersion <= 0 || !Number.isInteger(expectedVersion)) {
			throw new ServiceError("invalid_input");
		}

		const previousReferences = await storePort.getWorkingReferences({ entryId });
		const snapshot = await prepareSnapshot(rest as ServiceInput, { previousReferences });
		return storePort.saveWorkingWithReferences({
			entryId,
			expectedVersion,
			snapshot,
			references: snapshot.references,
			folderId,
			publishImmediately: options?.publishImmediately ?? isItemCollection(input.collection),
		});
	},

	/**
	 * 번역본을 만든다(v2 B4, v3). 원문(묶음의 원문)의 최신 초안 구조에 원문 글을 번역 안내로 둔 초안이다.
	 * 주소는 원문 주소를 그대로 쓴다(언어가 달라 겹치지 않는다). 폴더는 원문과 같다.
	 * 번역본을 가리켜 부르면 그 묶음의 원문에서 만든다.
	 */
	createTranslation: async (params: { sourceId: string; locale: string }) => {
		if (!isLocale(params.locale)) throw new ServiceError("invalid_input");
		const picked = await storePort.getWorking({ entryId: params.sourceId });
		const sourceId = picked.translationGroupId ?? params.sourceId;
		const source = sourceId === params.sourceId ? picked : await storePort.getWorking({ entryId: sourceId });
		if (!isCollection(source.collection) || isItemCollection(source.collection)) {
			throw new ServiceError("invalid_input");
		}
		// 번역본은 원문 틀에서 시작한다(v3). 구조(제목·문단·상자·목록·표)와 코드·이미지는 그대로 두고, 글자는
		// 번역 안내(흐린 원문 글)로 둔다. 제목·요약 같은 언어별 값은 비운다(편집 화면이 원문 제목을 자리 표시로 보인다).
		// 번역 상태에는 지금 원문을 "확인한 원문"으로 남긴다. 원문이 바뀌면 번역 화면이 알려 준다.
		const snapshot = await prepareSnapshot({
			collection: source.collection,
			slug: source.slug,
			metadata: {},
			mdx: withTranslationHints(source.mdx),
			translation: { version: 2, baseSource: source.mdx },
		} as ServiceInput);
		return storePort.createEntryWithReferences({
			snapshot,
			references: snapshot.references,
			folderId: source.folderId,
			publishImmediately: false,
			locale: params.locale,
			translationOf: sourceId,
		});
	},
});

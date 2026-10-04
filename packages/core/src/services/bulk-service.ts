import { prepareSnapshot } from "../core/snapshot";
import { storedField } from "../schema/derive";
import type { Issue, ServiceInput, StorePort, WorkingCopy } from "./types";
import { ServiceError } from "./types";

export const BULK_OPS = [
	"relation.add",
	"relation.remove",
	"relation.set",
	"folder.move",
	"archive",
	"unarchive",
	"trash",
	"publish",
	"permanentDelete",
] as const;
export type BulkOp = (typeof BULK_OPS)[number];

const LIFECYCLE_OPS: readonly BulkOp[] = ["archive", "unarchive", "trash", "publish"];

export type BulkItem = { readonly id: string; readonly expectedVersion: number };
export type BulkRequest = {
	readonly op: BulkOp;
	readonly items: readonly BulkItem[];
	/** `relation.*`이 바꾸는 관계 필드 이름. */
	readonly field?: string;
	/** `relation.add`·`relation.remove`: 여러 개 관계 필드에 더하거나 뺄 ID. */
	readonly ids?: readonly string[];
	/** `relation.set`: 하나짜리 관계 필드의 새 값. `null`이면 비운다. */
	readonly id?: string | null;
	readonly folderId?: string | null;
};

const RELATION_LIST_OPS: readonly BulkOp[] = ["relation.add", "relation.remove"];
/** 영구 삭제를 막은 참조(사용처). 휴지통 화면이 사유(`사용 중: ○○`)로 보여 준다. */
export type BulkUsage = {
	readonly entryId: string;
	readonly title: string | null;
	readonly collection: string;
	readonly state: string;
};
export type BulkItemResult =
	| { readonly id: string; readonly ok: true; readonly version: number }
	| {
			readonly id: string;
			readonly ok: false;
			readonly error: string;
			readonly issues?: readonly Issue[];
			readonly usages?: readonly BulkUsage[];
	  };

const MAX_ITEMS = 100;

/** 일괄 작업이 저장소에 요구하는 계약. 영구 삭제는 일괄 작업에서만 쓰므로 공통 `StorePort`에 넣지 않는다. */
export interface BulkStorePort<T = unknown> extends StorePort<T> {
	/** 휴지통 항목만 영구 삭제한다. 다른 콘텐츠가 참조하면 `in_use`(details.usages)로 거부한다. */
	permanentDeleteEntry(params: { id: string; expectedVersion: number }): Promise<void>;
}

const toServiceInput = (working: WorkingCopy, metadata: { [key: string]: unknown }): ServiceInput =>
	({ collection: working.collection, slug: working.slug, metadata, mdx: working.mdx }) as ServiceInput;

export const createBulkService = <T = unknown>(storePort: BulkStorePort<T>) => ({
	run: async (request: BulkRequest): Promise<{ results: BulkItemResult[] }> => {
		if (!request || typeof request !== "object" || !BULK_OPS.includes(request.op)) {
			throw new ServiceError("unknown_op");
		}
		if (!Array.isArray(request.items)) throw new ServiceError("invalid_input");
		if (request.items.length > MAX_ITEMS) throw new ServiceError("too_many_items");
		if (request.op.startsWith("relation.") && typeof request.field !== "string")
			throw new ServiceError("invalid_input");
		if (RELATION_LIST_OPS.includes(request.op) && !Array.isArray(request.ids)) throw new ServiceError("invalid_input");
		if (request.op === "relation.set" && request.id === undefined) throw new ServiceError("invalid_input");
		if (request.op === "folder.move" && request.folderId === undefined) throw new ServiceError("invalid_input");

		const results: BulkItemResult[] = [];
		for (const item of request.items) {
			if (!item || typeof item.id !== "string" || !item.id) {
				results.push({ id: "", ok: false, error: "invalid_input" });
				continue;
			}
			if (
				typeof item.expectedVersion !== "number" ||
				!Number.isInteger(item.expectedVersion) ||
				item.expectedVersion <= 0
			) {
				results.push({ id: item.id, ok: false, error: "invalid_input" });
				continue;
			}
			try {
				if (request.op === "permanentDelete") {
					// 휴지통 여부·참조는 저장소가 검사한다.
					try {
						await storePort.permanentDeleteEntry({ id: item.id, expectedVersion: item.expectedVersion });
					} catch (error) {
						// 같은 요청에서 먼저 지운 원문이 번역본을 함께 지웠다(v3). 이미 없는 항목은 지운 것으로 본다.
						if ((error as { code?: unknown })?.code !== "not_found") throw error;
					}
					// 삭제된 항목에는 새 버전이 없다. 요청한 버전을 그대로 돌려준다.
					results.push({ id: item.id, ok: true, version: item.expectedVersion });
					continue;
				}
				if (LIFECYCLE_OPS.includes(request.op)) {
					const lifecycleParams = { id: item.id, expectedVersion: item.expectedVersion };
					const acted =
						request.op === "archive"
							? await storePort.archiveEntry(lifecycleParams)
							: request.op === "unarchive"
								? await storePort.unarchiveEntry(lifecycleParams)
								: request.op === "trash"
									? await storePort.trashEntry(lifecycleParams)
									: await storePort.publishEntry(lifecycleParams);
					results.push({ id: item.id, ok: true, version: acted.version });
					continue;
				}
				const working = await storePort.getWorking({ entryId: item.id });
				const metadata: { [key: string]: unknown } = { ...working.metadata };
				let folderId: string | null | undefined;
				if (request.op.startsWith("relation.")) {
					const field = request.field ?? "";
					// 이 컬렉션의 관계 필드만 바꾼다. 더하기·빼기는 여러 개, 지정은 하나짜리 관계다.
					const relation = storedField(working.collection, field)?.field;
					const many = request.op !== "relation.set";
					if (relation?.kind !== "relation" || (relation.many === true) !== many) {
						throw new ServiceError("invalid_input");
					}
					if (many) {
						// 값이 하나도 없는 관계는 키 자체가 없다(편집기가 빈 배열을 지운다).
						const value = metadata[field];
						const current = Array.isArray(value) ? value.filter((t): t is string => typeof t === "string") : [];
						const ids = request.ids ?? [];
						const next =
							request.op === "relation.add"
								? [...current, ...ids.filter((t) => typeof t === "string" && !current.includes(t))]
								: current.filter((t) => !ids.includes(t));
						if (next.length > 0) metadata[field] = next;
						else delete metadata[field];
					} else if (request.id === null || request.id === undefined) {
						delete metadata[field];
					} else {
						metadata[field] = request.id;
					}
				} else {
					folderId = request.folderId ?? null;
				}
				const previousReferences = await storePort.getWorkingReferences({ entryId: item.id });
				const snapshot = await prepareSnapshot(toServiceInput(working, metadata), { previousReferences });
				const saved = (await storePort.saveWorkingWithReferences({
					entryId: item.id,
					expectedVersion: item.expectedVersion,
					snapshot,
					references: snapshot.references,
					folderId,
				})) as { version: number };
				results.push({ id: item.id, ok: true, version: saved.version });
			} catch (e) {
				const { code, issues, details } = (e ?? {}) as {
					code?: unknown;
					issues?: readonly Issue[];
					details?: { usages?: readonly BulkUsage[] };
				};
				const usages = details?.usages;
				results.push({
					id: item.id,
					ok: false,
					error: typeof code === "string" ? code : "internal",
					...(Array.isArray(issues) && issues.length > 0 ? { issues } : {}),
					...(Array.isArray(usages) && usages.length > 0 ? { usages } : {}),
				});
			}
		}
		return { results };
	},
});

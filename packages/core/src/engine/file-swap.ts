import { randomUUID } from "node:crypto";
import { open, rename, rm, writeFile } from "node:fs/promises";

/** 커밋 뒤 파일 하나에 쓸 변경: 새 내용과, 파일을 바꾼 뒤 공유 상태에 반영하는 일. */
export interface FileChange {
	file: string;
	text: () => Promise<string>;
	apply: () => void;
}

/** `file`이 덮어쓸 수 있는 파일인지 연다: 디렉터리이거나 쓰기 권한이 없으면 던진다. */
async function probe(file: string): Promise<void> {
	const handle = await open(file, "r+");
	await handle.close();
}

/**
 * 한 트랜잭션의 파일 변경들. `prepare`는 커밋 전에 각 파일 자리를 확인하고 새 내용을 같은 폴더의 임시 파일에 써 둔다.
 * `commit`은 커밋 뒤 임시 파일을 제자리로 바꾸고(rename) 공유 상태에 반영한다. `discard`는 남은 임시 파일을 지운다.
 */
export function fileChanges() {
	const changes: FileChange[] = [];
	const prepared: { temp: string; change: FileChange }[] = [];
	function add(change: FileChange): void {
		changes.push(change);
	}
	async function prepare(): Promise<void> {
		for (const change of changes) {
			const temp = `${change.file}.${randomUUID()}.tmp`;
			prepared.push({ temp, change });
			await probe(change.file);
			await writeFile(temp, await change.text());
		}
	}
	async function commit(): Promise<void> {
		for (const { temp, change } of prepared) {
			await rename(temp, change.file);
			change.apply();
		}
	}
	async function discard(): Promise<void> {
		await Promise.all(prepared.map(({ temp }) => rm(temp, { force: true })));
	}
	return { add, prepare, commit, discard };
}

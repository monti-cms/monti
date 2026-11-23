import { type Kysely, type QueryExecutorProvider, sql } from "kysely";
import { vi } from "vitest";

/** 한 번 열리는 문: `pass`를 부른 쪽은 `open`될 때까지 기다리고, `reached`는 누군가 문 앞에 왔을 때 풀린다. */
export interface Gate {
	reached: Promise<void>;
	open: () => void;
	pass: () => Promise<void>;
}

export function gate(): Gate {
	const reached = Promise.withResolvers<void>();
	const opened = Promise.withResolvers<void>();
	async function pass(): Promise<void> {
		reached.resolve();
		await opened.promise;
	}
	return { reached: reached.promise, open: () => opened.resolve(), pass };
}

/** 이 DB에서 잠금을 기다리는 연결 수. */
async function lockWaits(db: QueryExecutorProvider): Promise<number> {
	const { rows } = await sql<{ waiting: number }>`
		select count(*)::int as waiting from pg_stat_activity
		where datname = current_database() and wait_event_type = 'Lock'
	`.execute(db);
	return rows[0]?.waiting ?? 0;
}

/** 이 DB에서 잠금을 기다리는 연결이 `count`개가 될 때까지 기다린다. */
export async function waitForLockWaits(db: QueryExecutorProvider, count: number): Promise<void> {
	await vi.waitFor(
		async () => {
			if ((await lockWaits(db)) !== count) throw new Error("아직 잠금을 기다리는 연결이 없다");
		},
		{ timeout: 2000, interval: 10 },
	);
}

/** 실행이 거절되면 그 오류 코드, 성공하면 null. */
export async function codeOf(run: Promise<unknown>): Promise<string | null> {
	return run.then(
		() => null,
		(error: { code: string }) => error.code,
	);
}

/** 실행 하나의 결과: 성공하면 `code`가 null이고 `value`가 반환값, 거절되면 `code`가 오류 코드다. */
export interface Outcome<T> {
	code: string | null;
	value?: T;
}

async function outcomeOf<T>(run: Promise<T>): Promise<Outcome<T>> {
	return run.then(
		(value) => ({ code: null, value }),
		(error: { code?: unknown }) => ({ code: String(error.code ?? error) }),
	);
}

/**
 * `run`이 끝나면 `"settled"`, 그 전에 이 DB에서 잠금을 기다리는 연결이 생기면 `"waiting"`. 5초 안에 둘 다 아니면 실패한다.
 */
async function settledOrWaiting(db: QueryExecutorProvider, run: Promise<unknown>): Promise<"settled" | "waiting"> {
	let settled = false;
	void run.then(() => {
		settled = true;
	});
	const deadline = Date.now() + 5000;
	while (!settled) {
		if ((await lockWaits(db)) > 0) return "waiting";
		if (Date.now() > deadline) throw new Error("두 번째 실행이 끝나지도 잠금을 기다리지도 않는다");
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	return "settled";
}

/**
 * `db`와 같은 연결을 쓰되, SQL이 `pattern`에 맞는 첫 문장이 실행된 직후 `hold`가 끝날 때까지 그 결과를 돌려주지 않는 DB.
 * 그 문장을 실행한 쪽은 다음 문장으로 넘어가지 못하고 멈춘다. 한 번만 멈춘다.
 */
export function holdingAfter<DB>(db: Kysely<DB>, pattern: RegExp, hold: () => Promise<void>): Kysely<DB> {
	const executor = db.getExecutor();
	const held = new Set<string>();
	let armed = true;
	return db.withPlugin({
		transformQuery({ node, queryId }) {
			if (armed && pattern.test(executor.compileQuery(node, queryId).sql)) {
				armed = false;
				held.add(queryId.queryId);
			}
			return node;
		},
		async transformResult({ result, queryId }) {
			if (held.delete(queryId.queryId)) await hold();
			return result;
		},
	});
}

/** 겹침을 어떻게 확인할지. `commits`면 두 번째 실행이 첫 실행이 멈춘 동안 끝나야 한다(잠금을 기다리면 실패). */
export interface OverlapOptions {
	commits?: boolean;
}

/**
 * 두 실행을 겹치게 한다. `first`는 받은 `hold`를 부른 곳(커밋 직전이나 `holdingAfter`가 고른 문장 뒤)에서 멈추고, 그동안
 * `second`가 시작된다. `second`가 끝나거나 잠금을 기다리기 시작하면 `first`를 이어 가게 한다. 두 결과를 시작한 순서대로
 * 돌려준다. `first`가 멈추지 않고 끝나거나, `commits`인데 `second`가 잠금을 기다리면 겹칠 구간에 닿지 못한 것이라 실패한다.
 */
export async function overlap<A, B>(
	db: QueryExecutorProvider,
	first: (hold: () => Promise<void>) => Promise<A>,
	second: () => Promise<B>,
	options: OverlapOptions = {},
): Promise<[Outcome<A>, Outcome<B>]> {
	const held = gate();
	const firstRun = outcomeOf(first(held.pass));
	let secondRun: Promise<Outcome<B>> = Promise.resolve({ code: "NOT_STARTED" });
	// 도중에 실패해도 문을 열고 두 실행이 끝나기를 기다려, 트랜잭션이 연결을 잡은 채 남지 않게 한다.
	try {
		const reached = await Promise.race([held.reached.then(() => true), firstRun.then(() => false)]);
		// 문 앞에 오지 않고 끝나면 두 실행이 겹치지 않고 차례로 돈다: 경합 검사가 조용히 순차 검사가 되지 않게 실패한다.
		if (!reached) throw new Error("첫 실행이 hold를 부르지 않고 끝났다");
		secondRun = outcomeOf(second());
		const state = await settledOrWaiting(db, secondRun);
		if (options.commits === true && state === "waiting") {
			throw new Error("두 번째 실행이 첫 실행을 기다린다: 첫 실행이 멈춘 동안 끝나야 한다");
		}
	} finally {
		held.open();
		await Promise.allSettled([firstRun, secondRun]);
	}
	return [await firstRun, await secondRun];
}

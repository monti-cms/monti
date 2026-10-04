import { randomUUID } from "node:crypto";
import { createTranslator } from "@monti-cms/core/client";
import { z } from "zod";
import type { ResolvedAiAction } from "./action";
import type { AiProviderInput, AiProviderKind, AiProviderView, AiSettingsView } from "./connection";
import { AiError } from "./errors";
import {
	type AiDecider,
	type AiProvider,
	createDecider,
	createFakeDecider,
	createFakeGenerator,
	createGenerator,
	isFakeAi,
} from "./provider";
import { decryptSecret, encryptSecret, keyHint } from "./secret";
import { settingsMessages } from "./settings.messages";

const t = createTranslator(settingsMessages);

/** 설정 저장소(콘텐츠 저장소의 일부). 테스트는 메모리 구현을 넘긴다. */
export interface AiSettingsStore {
	getAiSettings(): Promise<{ value: unknown; version: number } | null>;
	saveAiSettings(params: { expectedVersion: number; value: unknown }): Promise<number>;
}

/** DB에 둔 연결 하나. 키는 암호문이다. */
const storedProviderSchema = z.object({
	id: z.string(),
	name: z.string(),
	kind: z.enum(["chat", "decisions"]),
	url: z.string().default(""),
	apiKey: z.string().nullable().default(null),
	defaultModel: z.string().default(""),
});
type StoredProvider = z.output<typeof storedProviderSchema>;

const storedSchema = z.object({ providers: z.array(storedProviderSchema).default([]) });

/**
 * 연결을 하나씩 두기 전(생성·판단 연결 한 벌) 모양. 읽을 때 연결 두 개로 옮긴다.
 * 저장하면 새 모양으로 바뀐다.
 */
const legacySchema = z.object({
	generate: z.object({ baseUrl: z.string(), apiKey: z.string().nullable(), smallModel: z.string() }),
	decide: z.object({ url: z.string(), apiKey: z.string().nullable(), shareKey: z.boolean(), model: z.string() }),
});

function readStored(value: unknown): StoredProvider[] {
	const legacy = legacySchema.safeParse(value);
	if (legacy.success) {
		const { generate, decide } = legacy.data;
		return [
			{
				id: "legacy-chat",
				name: t("legacyGenerate"),
				kind: "chat",
				url: generate.baseUrl,
				apiKey: generate.apiKey,
				defaultModel: generate.smallModel,
			},
			{
				id: "legacy-decisions",
				name: t("legacyDecide"),
				kind: "decisions",
				url: decide.url,
				apiKey: decide.shareKey ? generate.apiKey : decide.apiKey,
				defaultModel: decide.model,
			},
		].filter((provider) => provider.url || provider.defaultModel) as StoredProvider[];
	}
	return storedSchema.parse(value ?? {}).providers;
}

interface ResolvedProvider extends StoredProvider {
	/** 풀어 낸 키. 서버 설정의 `secret`이 바뀌어 풀지 못하면 `null`. */
	key: string | null;
}

async function load(store: AiSettingsStore): Promise<{ version: number; providers: ResolvedProvider[] }> {
	const row = await store.getAiSettings();
	const providers = readStored(row?.value).map((provider) => ({
		...provider,
		key: provider.apiKey ? decryptSecret(provider.apiKey) : null,
	}));
	return { version: row?.version ?? 0, providers };
}

const isReady = (provider: ResolvedProvider) => Boolean(provider.url && provider.key && provider.defaultModel);

const viewOf = (provider: ResolvedProvider): AiProviderView => ({
	id: provider.id,
	name: provider.name,
	kind: provider.kind,
	url: provider.url,
	keyHint: keyHint(provider.key),
	defaultModel: provider.defaultModel,
	ready: isReady(provider),
});

export async function getAiSettingsView(store: AiSettingsStore): Promise<AiSettingsView> {
	const { version, providers } = await load(store);
	return { version, providers: providers.map(viewOf), fake: isFakeAi() };
}

async function writeProviders(
	store: AiSettingsStore,
	expectedVersion: number,
	providers: StoredProvider[],
): Promise<AiSettingsView> {
	await store.saveAiSettings({
		expectedVersion,
		value: {
			providers: providers.map(({ id, name, kind, url, apiKey, defaultModel }) => ({
				id,
				name,
				kind,
				url,
				apiKey,
				defaultModel,
			})),
		},
	});
	return getAiSettingsView(store);
}

const toStored = (id: string, input: AiProviderInput, storedKey: string | null): StoredProvider => ({
	id,
	name: input.name,
	kind: input.kind,
	url: input.url.replace(/\/+$/, ""),
	apiKey: input.apiKey === undefined ? storedKey : input.apiKey === null ? null : encryptSecret(input.apiKey),
	defaultModel: input.defaultModel,
});

export async function addAiProvider(
	store: AiSettingsStore,
	expectedVersion: number,
	input: AiProviderInput,
): Promise<AiSettingsView> {
	const { providers } = await load(store);
	return writeProviders(store, expectedVersion, [...providers, toStored(randomUUID(), input, null)]);
}

/** 연결을 고친다. 키가 빠지면 저장된 키를 두고, `null`이면 지우고, 글자가 있으면 암호화해 바꾼다. */
export async function updateAiProvider(
	store: AiSettingsStore,
	expectedVersion: number,
	id: string,
	input: AiProviderInput,
): Promise<AiSettingsView> {
	const { providers } = await load(store);
	const current = providers.find((provider) => provider.id === id);
	if (!current) throw new AiError("ai_failed", t("unknownConnection"));
	// 주소를 바꾸면서 키를 새로 넣지 않으면, 예전 키를 다른 주소로 보내지 않도록 지운다.
	const keepKey = input.apiKey === undefined && input.url.replace(/\/+$/, "") !== current.url ? null : current.apiKey;
	return writeProviders(
		store,
		expectedVersion,
		providers.map((provider) => (provider.id === id ? toStored(id, input, keepKey) : provider)),
	);
}

export async function removeAiProvider(
	store: AiSettingsStore,
	expectedVersion: number,
	id: string,
): Promise<AiSettingsView> {
	const { providers } = await load(store);
	return writeProviders(
		store,
		expectedVersion,
		providers.filter((provider) => provider.id !== id),
	);
}

/** 저장된 연결의 주소·키(모델 목록을 받을 때). */
export async function savedProvider(
	store: AiSettingsStore,
	id: string,
): Promise<{ kind: AiProviderKind; url: string; apiKey: string | null } | null> {
	const provider = (await load(store)).providers.find((item) => item.id === id);
	return provider ? { kind: provider.kind, url: provider.url, apiKey: provider.key } : null;
}

type ActionConnection = Pick<ResolvedAiAction, "engine" | "providerId" | "modelName">;

const kindFor = (spec: Pick<ResolvedAiAction, "engine">): AiProviderKind =>
	spec.engine === "decide" ? "decisions" : "chat";

/**
 * 기능이 쓸 연결과 모델. 연결을 정하지 않았으면 방식에 맞는 첫 연결, 모델을 정하지 않았으면 연결의 기본 모델이다.
 * 쓸 수 없으면(연결이 없거나 키·주소가 비었으면) `null`.
 */
function pickConnection(
	providers: ResolvedProvider[],
	spec: ActionConnection,
): { provider: ResolvedProvider; model: string } | null {
	const kind = kindFor(spec);
	const provider = spec.providerId
		? providers.find((item) => item.id === spec.providerId && item.kind === kind)
		: providers.find((item) => item.kind === kind && isReady(item));
	if (!provider?.url || !provider.key) return null;
	const model = spec.modelName || provider.defaultModel;
	return model ? { provider, model } : null;
}

export interface AiRuntime {
	generator: AiProvider | null;
	decider: AiDecider | null;
}

/** 기능 하나를 실행할 생성·판단 모델. 기능의 방식에 맞는 쪽만 채운다. */
export async function loadAiRuntime(store: AiSettingsStore, spec: ActionConnection): Promise<AiRuntime> {
	if (isFakeAi()) return { generator: createFakeGenerator(), decider: createFakeDecider() };
	const picked = pickConnection((await load(store)).providers, spec);
	if (!picked || !picked.provider.key) return { generator: null, decider: null };
	const { provider, model } = picked;
	const key = picked.provider.key;
	return spec.engine === "decide"
		? { generator: null, decider: createDecider({ url: provider.url, apiKey: key, model }) }
		: { generator: createGenerator({ baseUrl: provider.url, apiKey: key, model }), decider: null };
}

/** 기능마다 지금 쓸 수 있는가(자리에 버튼을 붙일지). 쓸 수 있는 기능 이름을 돌려준다. */
export async function usableActionKeys(
	store: AiSettingsStore,
	actions: ReadonlyArray<ActionConnection & { key: string }>,
): Promise<string[]> {
	if (isFakeAi()) return actions.map((action) => action.key);
	const { providers } = await load(store);
	return actions.filter((action) => pickConnection(providers, action) !== null).map((action) => action.key);
}

/**
 * 연결 확인에 쓸 호출 준비. 저장하기 전 입력값(주소·키·모델)으로 만든다.
 * 키를 새로 넣지 않았으면, 같은 주소로 저장된 연결의 키를 쓴다(다른 주소로 저장된 키를 보내지 않는다).
 */
export async function connectionForCheck(
	store: AiSettingsStore,
	params: { providerId?: string; kind: AiProviderKind; url: string; apiKey?: string | null; model: string },
): Promise<{ model: string; generator?: AiProvider; decider?: AiDecider }> {
	const url = params.url.replace(/\/+$/, "");
	const saved = params.providerId
		? (await load(store)).providers.find((item) => item.id === params.providerId)
		: undefined;
	const apiKey = params.apiKey ?? (params.apiKey === undefined && saved?.url === url ? saved.key : null);
	if (!url || !params.model) throw new AiError("ai_unavailable", t("urlAndModel"));
	if (!apiKey) {
		throw new AiError("ai_unavailable", saved?.apiKey && !saved.key ? t("keyAgain") : t("key"));
	}
	const config = { apiKey, model: params.model };
	return params.kind === "chat"
		? { model: params.model, generator: createGenerator({ baseUrl: url, ...config }) }
		: { model: params.model, decider: createDecider({ url, ...config }) };
}

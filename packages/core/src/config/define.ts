import { type CodeBlockConfig, validateCodeBlockConfig } from "../annotation/code-block/line-effects";
import type { BlockDefinition } from "../blocks/define";
import { resolveBlocks } from "../blocks/resolve";
import { type MediaConfig, validateMediaConfig } from "../core/media-types";
import type { MessageValue } from "../i18n/define";
import { assertPluginNamesFree, assertPluginPagesFree } from "../plugin/collisions";
import type { CmsPlugin } from "../plugin/define";
import { type CollectionSchema, normalizeCollection, validateListColumns } from "../schema/collection";
import { RESERVED_METADATA_KEYS, SUMMARY_ROLE } from "../schema/fields";
import { valueFieldsOf } from "../schema/walk";

/** 언어 코드 모양(BCP 47의 언어와 지역·문자 부분). */
const LOCALE_CODE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

/**
 * 사이트 설정(`cms.config.ts`) 규격. 블로그마다 컬렉션·언어를 여기에 적고 `defineConfig`로 감싸 기본 내보내기로 둔다.
 *
 * 설정은 서버와 관리자 화면(브라우저)이 함께 읽으므로 **JSON으로 직렬화할 수 있는 값만** 가진다.
 * 비밀 값(DB 주소·API 키)은 넣지 않고 환경 변수로 둔다.
 */

export interface LocaleConfig<Code extends string = string> {
	/** 언어 코드(BCP 47 앞부분, 예: `ko`). 저장 값과 공개 주소 접두사에 쓴다. */
	readonly code: Code;
	/** 그 언어로 쓴 언어 이름(예: `English`). AI 번역 지시문에 들어간다. */
	readonly name: string;
	/** 관리자 화면에 보이는 이름. 없으면 `name`을 쓴다. */
	readonly label?: string;
}

export type CollectionsConfig = Readonly<Record<string, CollectionSchema>>;

export interface SiteConfig {
	/**
	 * 공개 사이트 주소(예: `https://example.com`). 본문에 전체 주소로 적은 링크도 내부 링크로 알아본다.
	 * 환경마다 다르면 환경 변수에서 읽는다. 없으면 `/posts/...`처럼 경로로 적은 링크만 알아본다.
	 */
	readonly url?: string;
	/** 같은 사이트로 볼 다른 호스트 이름(예: `www.example.com`). */
	readonly aliases?: readonly string[];
	/** 관리자 화면에 보이는 사이트 이름(사이드바·검색 미리보기·창 제목). 없으면 `url`의 호스트 이름. */
	readonly name?: string;
	/**
	 * 초안 미리보기 주소 앞부분(예: `/preview`). 편집 화면의 `미리보기`가 이 뒤에 공개 경로(컬렉션 `path`)를 붙여 연다.
	 * 기본 언어가 아니면 언어를 `previewLocaleParam` 쿼리로 넘긴다. 없으면 미리보기 단추가 없다.
	 */
	readonly previewPath?: string;
	/**
	 * 미리보기 주소에 언어를 넘기는 쿼리 이름. 기본 `locale`(`/preview/posts/a?locale=en`).
	 * `false`면 쿼리 대신 `localePrefix` 규칙대로 경로에 언어를 넣는다(`/preview/en/posts/a`).
	 */
	readonly previewLocaleParam?: string | false;
	/**
	 * 공개 주소에 언어를 붙이는 방식. 검색 미리보기·초안 미리보기·`localizePath`가 따른다.
	 * - `except-default`(기본): 기본 언어는 접두사 없이(`/posts/a`), 다른 언어는 `/{code}`(`/en/posts/a`)
	 * - `always`: 모든 언어에 `/{code}`
	 * - `never`: 어느 언어도 접두사 없이(언어마다 도메인이 다르거나 언어가 하나일 때)
	 */
	readonly localePrefix?: LocalePrefixMode;
	/**
	 * 관리자 사이드바 `사이트 보기`가 여는 주소. 경로(`/`)나 전체 주소(`https://example.com`). 기본 `/`
	 * (관리자 화면이 사이트 앱 안에 있을 때 사이트 첫 화면).
	 */
	readonly home?: string;
}

/** 공개 주소의 언어 접두사 방식(`site.localePrefix`). */
export type LocalePrefixMode = "except-default" | "always" | "never";
export const LOCALE_PREFIX_MODES: readonly LocalePrefixMode[] = ["except-default", "always", "never"];

export interface AdminConfig {
	/**
	 * 관리자 화면 경로. 기본 `/admin`. 앱의 관리자 라우트 폴더가 같은 경로여야 한다
	 * (`/studio`이면 `app/(admin)/studio/[[...path]]/page.tsx`). 관리자 API(`/api/cms/v1`)는 바뀌지 않는다.
	 */
	readonly path?: string;
	/**
	 * 관리자 화면 언어(BCP 47, 예: `en`, `ko-KR`). 화면 글과 날짜·숫자 표기가 따른다. 없으면 사이트 기본 언어(`defaultLocale`).
	 * 사전이 없는 언어는 영어로 보인다. 시각은 `timeZone`으로 보인다.
	 */
	readonly locale?: string;
	/**
	 * 관리자 화면 문구 덮어쓰기: 이름공간 → 키 → 문구(`{이름}` 자리를 쓸 수 있다). 이름공간·키는 각 패키지의 사전
	 * (`defineMessages`)에서 찾는다. 예: `{ "cms-admin.entries": { publish: "Ship it" } }`.
	 */
	readonly messages?: Readonly<Record<string, Readonly<Record<string, MessageValue>>>>;
	/**
	 * 예전 브라우저 복구본 DB 이름(IndexedDB). 관리자 화면이 이 이름으로 남은 복구본도 읽고 지우되 새로 만들지 않는다.
	 * 지금 이름은 `cms_backup`이다. 예전 이름으로 쓰던 사이트만 적는다.
	 */
	readonly legacyBackupNames?: readonly string[];
}

export interface SeedTemplate {
	/** 고정 ID(UUID). 마이그레이션을 여러 번 돌려도 같은 템플릿이 하나만 생긴다. */
	readonly id: string;
	readonly name: string;
	readonly mdx: string;
}

export interface SeedConfig {
	/**
	 * 새 저장소의 첫 마이그레이션 때 한 번만 넣는 본문 템플릿. 이미 넣은 저장소에는 나중에 더한 템플릿도 넣지 않고,
	 * 지운 템플릿을 되살리지 않는다.
	 */
	readonly templates?: readonly SeedTemplate[];
}

export interface CmsConfig<
	Collections extends CollectionsConfig = CollectionsConfig,
	Locale extends string = string,
	Plugins extends readonly CmsPlugin[] = readonly CmsPlugin[],
> {
	/** 컬렉션 이름 → 정의. 이름은 저장 값(`entries.collection`)이므로 운영 중에 바꾸지 않는다. */
	readonly collections: Collections;
	/** 콘텐츠 언어. 선언 순서가 화면에 보이는 순서다. */
	readonly locales: readonly LocaleConfig<Locale>[];
	/** 기본 언어. 공개 주소에 언어 접두사를 붙이지 않는다. */
	readonly defaultLocale: NoInfer<Locale>;
	readonly site?: SiteConfig;
	/**
	 * 날짜·시각을 입력하고 보이는 시간대(IANA, 예: `Asia/Seoul`). 발행일 입력이 이 시간대의 벽시계다.
	 * 없으면 `UTC`.
	 */
	readonly timeZone?: string;
	/** 새 저장소에 처음 넣을 데이터. */
	readonly seed?: SeedConfig;
	/** 관리자 화면 설정. */
	readonly admin?: AdminConfig;
	/**
	 * 사이트가 더하는 본문 블록(`defineBlock`). 콜아웃·탭 같은 블록은 블록 확장(`@monti-cms/blocks`)을 `plugins`에
	 * 넣어 더한다. 공개 화면은 사이트가 `component` 이름으로 그린다.
	 */
	readonly blocks?: readonly BlockDefinition[];
	/** 플러그인(예: `aiPlugin()`). 이름은 겹치지 않아야 한다. */
	readonly plugins?: Plugins;
	/** 코드 블록 설정. 줄 효과(`lineEffects`)를 더하거나 본체 기본(강조·추가·삭제·경고·오류)을 바꾼다. */
	readonly codeBlock?: CodeBlockConfig;
	/** 올릴 수 있는 미디어 형식과 크기 한도. 없으면 지원 형식 전부, 이미지 10MB·4천만 픽셀, 첨부 파일 50MB. */
	readonly media?: MediaConfig;
}

const ROLE_NAME = /^[A-Za-z][A-Za-z0-9-]*$/;

/**
 * 두 공개 주소 규칙(`/posts/:slug` 꼴)이 같은 주소를 만들 수 있는가. 같으면 본문 링크가 어느 컬렉션을 가리키는지 정할 수 없다.
 * slug는 `/` 없는 한 마디 안에 있으므로 마디 수가 같고 마디마다 맞을 수 있으면 겹친다:
 * 글자 마디끼리는 같아야 하고, slug 마디(`앞:slug뒤`)는 글자 마디가 그 앞뒤로 시작·끝나면(slug는 한 글자 이상),
 * slug 마디끼리는 앞부분 하나가 다른 하나로 시작하고 뒷부분 하나가 다른 하나로 끝나면 맞을 수 있다.
 */
export function pathsOverlap(a: string, b: string): boolean {
	const segments = (path: string) => path.replace(/\/+$/, "").split("/");
	const left = segments(a);
	const right = segments(b);
	if (left.length !== right.length) return false;
	return left.every((x, index) => {
		const y = right[index] ?? "";
		const xs = x.split(":slug");
		const ys = y.split(":slug");
		if (xs.length === 1 && ys.length === 1) return x === y;
		if (xs.length === 1 || ys.length === 1) {
			const literal = xs.length === 1 ? x : y;
			const [prefix = "", suffix = ""] = xs.length === 1 ? ys : xs;
			return literal.length > prefix.length + suffix.length && literal.startsWith(prefix) && literal.endsWith(suffix);
		}
		const [xp = "", xsuf = ""] = xs;
		const [yp = "", ysuf = ""] = ys;
		return (xp.startsWith(yp) || yp.startsWith(xp)) && (xsuf.endsWith(ysuf) || ysuf.endsWith(xsuf));
	});
}
const checkTab = (at: string, tab: string | undefined) => {
	if (tab !== undefined && (!tab.trim() || tab.length > 20)) throw new Error(`${at}.tab must be 1-20 characters`);
};

/**
 * 필드 역할(`role`)·탭(`tab`)·본문에서 채우기(`fillFromBody`)·주소 원본(`from`)이 맞는지 확인한다. 역할은 컬렉션마다 하나씩이고,
 * 본체가 아는 역할(`summary`)만 종류를 본다. 다른 역할의 종류는 그 역할을 쓰는 플러그인이 `validate`에서 본다.
 */
function validateFieldMeanings(collection: string, schema: CollectionSchema): void {
	const roles = new Map<string, string>();
	for (const { name, field } of valueFieldsOf(schema)) {
		const role = field.role;
		if (role !== undefined) {
			if (!ROLE_NAME.test(role)) throw new Error(`cms.config: ${collection}.${name} has an invalid role "${role}"`);
			if (role === SUMMARY_ROLE && field.kind !== "text") {
				throw new Error(`cms.config: ${collection}.${name} role "${role}" needs a text field`);
			}
			const other = roles.get(role);
			if (other) throw new Error(`cms.config: ${collection} has role "${role}" on both ${other} and ${name}`);
			roles.set(role, name);
		}
		if (RESERVED_METADATA_KEYS.includes(name)) {
			throw new Error(`cms.config: ${collection}.${name} uses a reserved name; rename the field`);
		}
		if (field.kind === "text" && field.fillFromBody && !schema.body) {
			throw new Error(`cms.config: ${collection}.${name} fillFromBody needs a collection with a body`);
		}
		if (field.kind === "text" && typeof field.fillFromBody === "object") {
			const { maxLength } = field.fillFromBody;
			if (maxLength !== undefined && (!Number.isInteger(maxLength) || maxLength < 1)) {
				throw new Error(`cms.config: ${collection}.${name} fillFromBody.maxLength must be a positive integer`);
			}
		}
		if (field.kind === "media" && field.accept !== undefined && field.accept !== "image" && field.accept !== "file") {
			throw new Error(`cms.config: ${collection}.${name} accept must be "image" or "file"`);
		}
	}
	for (const [index, group] of (schema.layout ?? []).entries()) {
		checkTab(`cms.config: ${collection}.layout[${index}]`, group.tab);
	}
	for (const [name, field] of Object.entries(schema.fields)) {
		if (RESERVED_METADATA_KEYS.includes(name)) {
			throw new Error(`cms.config: ${collection}.${name} uses a reserved name; rename the field`);
		}
		checkTab(`cms.config: ${collection}.${name}`, field.tab);
		if (field.kind === "view" && !/^[a-z][a-z0-9-]*$/.test(field.view)) {
			throw new Error(`cms.config: ${collection}.${name} view must be a kebab-case name`);
		}
	}
	for (const [name, field] of Object.entries(schema.fields)) {
		if (field.kind !== "slug" || field.from === undefined) continue;
		if (schema.fields[field.from]?.kind !== "text") {
			throw new Error(`cms.config: ${collection}.${name} is made from "${field.from}", which is not a text field`);
		}
	}
}

/** 관리자 화면 기본 경로(`admin.path`가 없을 때). */
export const DEFAULT_ADMIN_PATH = "/admin";

/** 관리자 경로 모양: `/`로 시작하는 한 칸 이상의 경로(끝 `/` 없이), `/api` 아래는 안 된다. */
export const isAdminPath = (path: string): boolean =>
	/^(\/[A-Za-z0-9._~-]+)+$/.test(path) && !/^\/api(\/|$)/.test(path);

const isHomeHref = (href: string): boolean => {
	if (href.startsWith("/")) return !href.startsWith("//");
	try {
		const url = new URL(href);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
};

/** 설정이 서로 맞는지 확인한다. 틀리면 앱이 뜰 때 바로 알린다. */
function validate(config: CmsConfig<CollectionsConfig, string, readonly CmsPlugin[]>): void {
	const names = Object.keys(config.collections);
	if (names.length === 0) throw new Error("cms.config: `collections` is empty");

	const codes = config.locales.map((locale) => locale.code);
	if (codes.length === 0) throw new Error("cms.config: `locales` is empty");
	if (new Set(codes).size !== codes.length) throw new Error("cms.config: `locales` has duplicate codes");
	// 언어 코드는 주소·DB 기본값(마이그레이션)에 그대로 들어간다. BCP 47 모양(`ko`, `en`, `pt-BR`, `zh-Hant`)만 받는다.
	for (const code of codes) {
		if (!LOCALE_CODE.test(code)) {
			throw new Error(`cms.config: locale code "${code}" must look like "en", "pt-BR" or "zh-Hant"`);
		}
	}
	if (!codes.includes(config.defaultLocale)) {
		throw new Error(`cms.config: defaultLocale "${config.defaultLocale}" is not in \`locales\``);
	}

	if (config.site?.url !== undefined) {
		let url: URL | undefined;
		try {
			url = new URL(config.site.url);
		} catch {}
		if (url?.protocol !== "http:" && url?.protocol !== "https:") {
			throw new Error(`cms.config: site.url "${config.site.url}" is not an http(s) URL`);
		}
	}

	if (config.timeZone !== undefined) {
		try {
			new Intl.DateTimeFormat("en-US", { timeZone: config.timeZone });
		} catch {
			throw new Error(`cms.config: timeZone "${config.timeZone}" is not an IANA time zone`);
		}
	}

	if (config.admin?.path !== undefined && !isAdminPath(config.admin.path)) {
		throw new Error(
			`cms.config: admin.path "${config.admin.path}" must be a path like "/admin" (not "/" and not under "/api")`,
		);
	}
	if (config.site?.localePrefix !== undefined && !LOCALE_PREFIX_MODES.includes(config.site.localePrefix)) {
		throw new Error(`cms.config: site.localePrefix must be one of ${LOCALE_PREFIX_MODES.join(", ")}`);
	}
	const previewParam = config.site?.previewLocaleParam;
	if (previewParam !== undefined && previewParam !== false && !/^[A-Za-z][\w-]*$/.test(previewParam)) {
		throw new Error(`cms.config: site.previewLocaleParam "${previewParam}" is not a query name`);
	}
	if (config.site?.home !== undefined && !isHomeHref(config.site.home)) {
		throw new Error(`cms.config: site.home "${config.site.home}" must be a path ("/") or an http(s) URL`);
	}

	if (config.admin?.locale !== undefined) {
		try {
			new Intl.DateTimeFormat(config.admin.locale);
		} catch {
			throw new Error(`cms.config: admin.locale "${config.admin.locale}" is not a valid locale`);
		}
	}

	const templateIds = new Set<string>();
	for (const template of config.seed?.templates ?? []) {
		if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(template.id)) {
			throw new Error(`cms.config: seed template "${template.name}" needs a UUID id`);
		}
		if (templateIds.has(template.id.toLowerCase())) {
			throw new Error(`cms.config: seed template id "${template.id}" is duplicated`);
		}
		templateIds.add(template.id.toLowerCase());
	}

	const paths = new Map<string, string>();
	for (const [collection, schema] of Object.entries(config.collections)) {
		// 라이브러리 약속: 제목 필드 이름은 `title`이다(이름표는 자유). 목록·검색·관계 고르기·본문 링크·편집 화면 제목 칸이 쓴다.
		if (schema.fields.title?.kind !== "text") {
			throw new Error(`cms.config: ${collection} needs a "title" text field (fields.text)`);
		}
		// 주소는 콘텐츠마다 하나다(저장소의 주소 열이 하나). 둘째 주소 필드는 쓰이지 않으므로 설정 오류로 막는다.
		const slugFields = Object.entries(schema.fields).filter(([, field]) => field.kind === "slug");
		if (slugFields.length > 1) {
			throw new Error(
				`cms.config: ${collection} has more than one slug field (${slugFields.map(([name]) => name).join(", ")}); a collection can have only one`,
			);
		}
		validateFieldMeanings(collection, schema);
		validateListColumns(collection, schema);
		if (schema.path !== undefined) {
			const { path } = schema;
			if (!path.startsWith("/") || path.split(":slug").length !== 2 || /:(?!slug)/.test(path) || /[?#]/.test(path)) {
				throw new Error(`cms.config: ${collection}.path "${path}" must start with "/" and contain ":slug" once`);
			}
			if (!Object.values(schema.fields).some((field) => field.kind === "slug")) {
				throw new Error(`cms.config: ${collection}.path needs a slug field`);
			}
			for (const [otherPath, other] of paths) {
				if (pathsOverlap(path, otherPath)) {
					throw new Error(
						`cms.config: ${collection}.path "${path}" can make the same URL as ${other}.path "${otherPath}"`,
					);
				}
			}
			paths.set(path, collection);
		}
		for (const { name, field } of valueFieldsOf(schema)) {
			if (field.kind === "relation" && !Object.hasOwn(config.collections, field.to)) {
				throw new Error(`cms.config: ${collection}.${name} relates to unknown collection "${field.to}"`);
			}
		}
		for (const [name, field] of Object.entries(schema.fields)) {
			if (field.kind !== "backlink") continue;
			const source = config.collections[field.from];
			if (!source) throw new Error(`cms.config: ${collection}.${name} links from unknown collection "${field.from}"`);
			const via = valueFieldsOf(source).find((stored) => stored.name === field.via)?.field;
			if (via?.kind !== "relation" || !via.many || via.to !== collection) {
				throw new Error(
					`cms.config: ${collection}.${name} needs ${field.from}.${field.via} to be a many relation to "${collection}"`,
				);
			}
		}
	}

	const blockDefinitions = resolveBlocks(config);
	const blocks = blockDefinitions.map((block) => block.name);
	validateCodeBlockConfig(config.codeBlock);
	validateMediaConfig(config.media);

	const plugins = config.plugins ?? [];
	const pluginNames = plugins.map((plugin) => plugin.name);
	if (new Set(pluginNames).size !== pluginNames.length) throw new Error("cms.config: `plugins` has duplicate names");
	assertPluginNamesFree(pluginNames);
	assertPluginPagesFree(
		plugins.flatMap((plugin) => (plugin.nav ?? []).map((item) => ({ plugin: plugin.name, path: item.path }))),
	);
	for (const plugin of plugins) {
		plugin.validate?.({
			collections: config.collections,
			locales: config.locales,
			defaultLocale: config.defaultLocale,
			blocks,
			blockDefinitions,
			plugins,
		});
	}
}

/** 사이트 설정을 정의한다. 컬렉션·언어 이름을 타입으로 보존하고, 서로 맞지 않는 설정은 바로 알린다. */
export function defineConfig<
	const Collections extends CollectionsConfig,
	const Locale extends string,
	const Plugins extends readonly CmsPlugin[] = readonly [],
>(config: CmsConfig<Collections, Locale, Plugins>): CmsConfig<Collections, Locale, Plugins> {
	// `defineCollection` 없이 적은 정의와 예전 이름(`workflow`)도 받는다. 본체는 정리한 `kind`만 읽는다.
	const collections = Object.fromEntries(
		Object.entries(config.collections).map(([name, schema]) => [name, normalizeCollection(schema)]),
	) as unknown as Collections;
	const normalized = { ...config, collections };
	validate(normalized);
	return normalized;
}

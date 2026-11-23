import { MontiError } from "./errors";
import type { KeyServiceDefinition, Operation, Plugin, ResourceTree } from "./types";

/** `monti`에 엔진이 직접 다는 메서드 이름: 리소스 이름으로 쓰면 메서드를 가린다. */
const ENGINE_METHODS = ["spec", "transaction", "dryRun", "onEvent"];

/**
 * The resource tree with each plugin's operations added at `<resource>.<action>`. A plugin may add actions to an
 * existing resource; a path that is already taken, by the core or by an earlier plugin, is rejected, and so is a
 * resource named after an engine method. `resources` is left as it is.
 */
export function withPlugins<R extends ResourceTree>(resources: ResourceTree, plugins: Plugin<R>[]): ResourceTree {
	const tree: ResourceTree = { ...resources };
	for (const plugin of plugins) {
		for (const [resource, actions] of Object.entries(plugin.operations ?? {})) {
			if (ENGINE_METHODS.includes(resource)) {
				throw new MontiError(
					"CONFLICT",
					`플러그인 "${plugin.name}"의 리소스 이름 "${resource}"이 엔진 메서드와 겹친다`,
				);
			}
			tree[resource] = addActions(tree[resource], actions, plugin.name, resource);
		}
	}
	return tree;
}

function addActions(
	existing: Operation | ResourceTree | undefined,
	actions: Record<string, Operation>,
	plugin: string,
	resource: string,
): ResourceTree {
	const merged: ResourceTree = { ...(existing as ResourceTree | undefined) };
	for (const [action, operation] of Object.entries(actions)) {
		if (Object.hasOwn(merged, action)) {
			throw new MontiError(
				"CONFLICT",
				`The plugin "${plugin}" adds the operation "${resource}.${action}", whose path is already taken.`,
			);
		}
		merged[action] = operation;
	}
	return merged;
}

/** 마이그레이션 출처로 코어와 프로젝트가 쓰는 이름: 플러그인 이름으로 쓸 수 없다. */
const RESERVED_SOURCES = ["@monti-cms/core", "project"];

/**
 * 플러그인 이름은 마이그레이션 출처가 되므로 예약된 출처 이름이면 `BAD_REQUEST`, 서로 겹치면 `CONFLICT`로 거절한다.
 */
export function checkPluginNames<R extends ResourceTree>(plugins: Plugin<R>[]): void {
	const names = plugins.map((plugin) => plugin.name);
	const reserved = names.find((name) => RESERVED_SOURCES.includes(name));
	if (reserved !== undefined) throw new MontiError("BAD_REQUEST", `플러그인 이름 "${reserved}"은 예약된 출처 이름이다`);
	const duplicate = names.find((name, index) => names.indexOf(name) !== index);
	if (duplicate !== undefined) throw new MontiError("CONFLICT", `플러그인 이름 "${duplicate}"이 중복된다`);
}

/** The key services every plugin registers, in plugin order. */
export function keyServicesOf<R extends ResourceTree>(plugins: Plugin<R>[]): KeyServiceDefinition[] {
	return plugins.filter(hasKeyServices).flatMap(keyServicesOfPlugin);
}

function hasKeyServices<R extends ResourceTree>(
	plugin: Plugin<R>,
): plugin is Plugin<R> & { keyServices: KeyServiceDefinition[] } {
	return plugin.keyServices !== undefined;
}

function keyServicesOfPlugin<R extends ResourceTree>(
	plugin: Plugin<R> & { keyServices: KeyServiceDefinition[] },
): KeyServiceDefinition[] {
	return plugin.keyServices;
}

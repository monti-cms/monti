import { MontiError } from "./errors";
import type { KeyServiceDefinition, Operation, Plugin, ResourceTree } from "./types";

/**
 * The resource tree with each plugin's operations added at `<resource>.<action>`. A plugin may add actions to an
 * existing resource; a path that is already taken, by the core or by an earlier plugin, is rejected. `resources` is
 * left as it is.
 */
export function withPlugins<R extends ResourceTree>(resources: ResourceTree, plugins: Plugin<R>[]): ResourceTree {
	const tree: ResourceTree = { ...resources };
	for (const plugin of plugins) {
		for (const [resource, actions] of Object.entries(plugin.operations ?? {})) {
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

import { MontiError } from "./errors";
import { isOperation } from "./operation";
import type { Operation, Plugin, ResourceTree } from "./types";

/**
 * The resource tree with each plugin's operations added at `<resource>.<action>`. A plugin may add actions to an
 * existing resource; a path that is already taken, by the core or by an earlier plugin, is rejected. `resources` is
 * left as it is.
 */
export function withPlugins(resources: ResourceTree, plugins: Plugin[]): ResourceTree {
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
	if (existing !== undefined && isOperation(existing)) throw taken(plugin, resource);
	const merged: ResourceTree = { ...existing };
	for (const [action, operation] of Object.entries(actions)) {
		if (Object.hasOwn(merged, action)) throw taken(plugin, `${resource}.${action}`);
		merged[action] = operation;
	}
	return merged;
}

function taken(plugin: string, path: string): MontiError {
	return new MontiError(
		"CONFLICT",
		`The plugin "${plugin}" adds the operation "${path}", whose path is already taken.`,
	);
}

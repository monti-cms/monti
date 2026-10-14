const DEV_CONNECTIONS = Symbol.for("monti.cms.dev-connections");
export function connectionsFor(id, server) {
    if (process.env.NODE_ENV !== "development")
        return { database: server.database };
    const global = globalThis;
    const registry = global[DEV_CONNECTIONS] ?? new Map();
    global[DEV_CONNECTIONS] = registry;
    let connections = registry.get(id);
    if (!connections) {
        connections = { database: server.database };
        registry.set(id, connections);
    }
    return connections;
}

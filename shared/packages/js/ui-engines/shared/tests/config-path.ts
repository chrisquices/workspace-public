/** Build a nested input from a public setting path for table-driven validation cases. */
export function configAt(path: string, value: unknown): Record<string, unknown> {
    return path.split('.').reduceRight((child, key) => ({[key]: child}), value) as Record<string, unknown>;
}

/** Exercise an actual reactive leaf rather than replacing its parent group. */
export function setConfigPath(config: object, path: string, value: unknown): void {
    const keys = path.split('.');
    const parent = keys.slice(0, -1).reduce((node, key) => node[key], config);
    parent[keys.at(-1)!] = value;
}

export function getConfigPath(config: object, path: string): unknown {
    return path.split('.').reduce((node, key) => node[key], config);
}

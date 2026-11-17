export function getDestructuredFields(pattern, prefix = []) {
    const fields = [];
    for (const property of pattern.properties) {
        if (property.type !== 'Property') {
            fields.push({property, path: prefix, value: property, defaulted: false});
            continue;
        }
        const name = property.computed ? property.key.type === 'Literal' ? property.key.value : null
            : property.key.name ?? property.key.value;
        const path = [...prefix, name];
        const defaulted = property.value.type === 'AssignmentPattern';
        const value = defaulted ? property.value.left : property.value;
        if (value.type === 'ObjectPattern') fields.push(...getDestructuredFields(value, path));
        else fields.push({property, path, value, defaulted});
    }
    return fields;
}

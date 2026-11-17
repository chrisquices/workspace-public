export type SortDirection = 'asc' | 'desc';

export type SortValue = string | number | Date | null | undefined;

export type SortComparator<T> = (left: NonNullable<T>, right: NonNullable<T>) => number;

export interface SortOptions<T, TValue = SortValue> {
    by: (item: T) => TValue;
    direction?: SortDirection;
    compare?: SortComparator<TValue>;
}

const collator = new Intl.Collator(undefined, {numeric: true});

function isMissing(value: unknown): boolean {
    return value == null || (typeof value === 'number' && Number.isNaN(value))
        || (value instanceof Date && Number.isNaN(value.getTime()));
}

function compareValues(left: unknown, right: unknown): number {
    const leftValue = left instanceof Date ? left.getTime() : left;
    const rightValue = right instanceof Date ? right.getTime() : right;

    if (typeof leftValue === 'string' && typeof rightValue === 'string') {
        return collator.compare(leftValue, rightValue);
    }

    if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        return leftValue === rightValue ? 0 : leftValue < rightValue ? -1 : 1;
    }

    // Mixed default values have a fixed type order: numbers/dates before strings.
    if (typeof leftValue === 'number' && typeof rightValue === 'string') {
        return -1;
    }

    if (typeof leftValue === 'string' && typeof rightValue === 'number') {
        return 1;
    }

    throw new TypeError('Sorting these values requires a custom comparator.');
}

export function sort<T, TValue extends SortValue>(items: readonly T[], options: SortOptions<T, TValue>): T[];

export function sort<T, TValue>(items: readonly T[], options: SortOptions<T, TValue> & {compare: SortComparator<TValue>}): T[];

/** Sort a copy using one selector evaluation per item; equal values retain input order. */
export function sort<T, TValue>(items: readonly T[], options: SortOptions<T, TValue>): T[] {
    const direction = options.direction ?? 'asc';

    if (direction !== 'asc' && direction !== 'desc') {
        throw new TypeError('Sort direction must be asc or desc.');
    }

    const compare = options.compare ?? compareValues;
    const entries = items.map(function (item, index) {
        return {item: item, index: index, value: options.by(item)};
    });

    entries.sort(function (left, right) {
        const leftMissing = isMissing(left.value);
        const rightMissing = isMissing(right.value);

        if (leftMissing || rightMissing) {
            return leftMissing === rightMissing ? left.index - right.index : leftMissing ? 1 : -1;
        }

        const result = compare(left.value as NonNullable<TValue>, right.value as NonNullable<TValue>);

        if (typeof result !== 'number' || Number.isNaN(result)) {
            throw new TypeError('Sort comparators must return a number other than NaN.');
        }

        return result === 0 ? left.index - right.index : direction === 'asc' ? result : -result;
    });

    return entries.map(function (entry) {
        return entry.item;
    });
}

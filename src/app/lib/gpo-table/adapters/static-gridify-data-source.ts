import { readGpoTableValue } from '../core/gpo-table.helpers';
import { GpoTableDataSource, GpoTableValue } from '../core/gpo-table.types';

/** Источник для демо: строки в памяти, пагинация и сортировка на клиенте */
export function staticGridifyDataSource<TRow extends object>(
    rows: readonly TRow[],
    isMatch?: (row: TRow, filter?: string) => boolean,
): GpoTableDataSource<TRow> {
    return {
        async getPage(query) {
            const matched = query.filter && isMatch ? rows.filter((row) => isMatch(row, query.filter)) : [...rows];
            const sort = query.sort;

            const sorted = sort
                ? matched.sort((a, b) =>
                      compareValues(
                          readGpoTableValue(a, sort.field),
                          readGpoTableValue(b, sort.field),
                          sort.direction,
                      ),
                  )
                : matched;

            const start = (query.page - 1) * query.pageSize;
            return { rows: sorted.slice(start, start + query.pageSize), total: sorted.length };
        },
    };
}

/** Сравнить значения ячеек для клиентской сортировки */
function compareValues(a: GpoTableValue, b: GpoTableValue, direction: 'asc' | 'desc'): number {
    let result: number;

    if (a instanceof Date && b instanceof Date) {
        result = a.getTime() - b.getTime();
    } else if (typeof a === 'number' && typeof b === 'number') {
        result = a - b;
    } else {
        result = String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true });
    }

    return direction === 'asc' ? result : -result;
}

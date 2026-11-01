import { GpoTableQuery } from '../core/gpo-table.types';
import { staticGridifyDataSource } from './static-gridify-data-source';

interface Row {
    id: number;
    name: string;
    count: number;
    createdAt: Date;
}

const ROWS: readonly Row[] = [
    { id: 1, name: 'gamma', count: 30, createdAt: new Date(2026, 2, 3) },
    { id: 2, name: 'alpha', count: 10, createdAt: new Date(2026, 0, 1) },
    { id: 3, name: 'beta', count: 20, createdAt: new Date(2026, 1, 2) },
    { id: 4, name: 'delta', count: 40, createdAt: new Date(2026, 3, 4) },
    { id: 5, name: 'epsilon', count: 50, createdAt: new Date(2026, 4, 5) },
];

function query(patch: Partial<GpoTableQuery> = {}): GpoTableQuery {
    return { page: 1, pageSize: 10, sort: null, ...patch };
}

describe('staticGridifyDataSource', () => {
    it('отдаёт страницу и общее количество', async () => {
        const source = staticGridifyDataSource(ROWS);

        const result = await source.getPage(query({ page: 2, pageSize: 2 }));

        expect(result.rows.map((row) => row.id)).toEqual([3, 4]);
        expect(result.total).toBe(5);
    });

    it('возвращает пустую страницу за пределами данных', async () => {
        const source = staticGridifyDataSource(ROWS);

        const result = await source.getPage(query({ page: 10, pageSize: 2 }));

        expect(result.rows).toEqual([]);
        expect(result.total).toBe(5);
    });

    it('сортирует по возрастанию и убыванию', async () => {
        const source = staticGridifyDataSource(ROWS);

        const asc = await source.getPage(query({ sort: { field: 'count', direction: 'asc' } }));
        const desc = await source.getPage(query({ sort: { field: 'count', direction: 'desc' } }));

        expect(asc.rows.map((row) => row.count)).toEqual([10, 20, 30, 40, 50]);
        expect(desc.rows.map((row) => row.count)).toEqual([50, 40, 30, 20, 10]);
    });

    it('сортирует даты по времени, а не по строке', async () => {
        const source = staticGridifyDataSource(ROWS);

        const result = await source.getPage(query({ sort: { field: 'createdAt', direction: 'asc' } }));

        expect(result.rows.map((row) => row.id)).toEqual([2, 3, 1, 4, 5]);
    });

    it('фильтрует строки предикатом и считает общее количество после фильтра', async () => {
        const source = staticGridifyDataSource(ROWS, (row, filter) =>
            (filter ?? '').includes('count>=30') ? row.count >= 30 : true,
        );

        const result = await source.getPage(query({ page: 1, pageSize: 10, filter: 'count>=30' }));

        expect(result.rows.map((row) => row.id)).toEqual([1, 4, 5]);
        expect(result.total).toBe(3);
    });

    it('не меняет исходный массив при сортировке', async () => {
        const source = staticGridifyDataSource(ROWS);
        const before = ROWS.map((row) => row.id);

        await source.getPage(query({ sort: { field: 'count', direction: 'desc' } }));

        expect(ROWS.map((row) => row.id)).toEqual(before);
    });
});

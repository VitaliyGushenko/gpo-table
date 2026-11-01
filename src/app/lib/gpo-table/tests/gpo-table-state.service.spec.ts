import { GPO_TABLE_DEFAULT_PAGE_SIZE, GpoTableStateService } from '../services/gpo-table-state.service';
import { GpoTableDataSource, GpoTablePage, GpoTableQuery } from '../core/gpo-table.types';

interface Row {
    id: number;
    name?: string;
}

interface Totals {
    count: number;
}

interface Deferred<T> {
    readonly promise: Promise<T>;
    resolve(value: T): void;
}

function deferred<T>(): Deferred<T> {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((resolvePromise) => {
        resolve = resolvePromise;
    });
    return { promise, resolve };
}

function page(rows: readonly Row[], total = rows.length): GpoTablePage<Row> {
    return { rows, total };
}

function createSource(getPage: (query: GpoTableQuery) => Promise<GpoTablePage<Row>>): GpoTableDataSource<Row> {
    return { getPage };
}

describe('GpoTableStateService', () => {
    it('начинает с первой страницы и размера по умолчанию', () => {
        const state = new GpoTableStateService<Row>();

        expect(state.page()).toBe(1);
        expect(state.pageSize()).toBe(GPO_TABLE_DEFAULT_PAGE_SIZE);
        expect(state.sort()).toBeNull();
        expect(state.filter()).toBeUndefined();
    });

    describe('изменение запроса', () => {
        it('смена размера страницы возвращает на первую', () => {
            const state = new GpoTableStateService<Row>();
            state.setPage(3);

            state.setPageSize(50);

            expect(state.page()).toBe(1);
            expect(state.pageSize()).toBe(50);
        });

        it('смена сортировки возвращает на первую', () => {
            const state = new GpoTableStateService<Row>();
            state.setPage(4);

            state.setSort({ field: 'name', direction: 'asc' });

            expect(state.page()).toBe(1);
            expect(state.sort()).toEqual({ field: 'name', direction: 'asc' });
        });

        it('смена фильтра возвращает на первую и обрезает пробелы', () => {
            const state = new GpoTableStateService<Row>();
            state.setPage(2);

            state.setFilter('  status=active  ');

            expect(state.page()).toBe(1);
            expect(state.filter()).toBe('status=active');
        });

        it('одинаковые значения не создают новый объект запроса', () => {
            const state = new GpoTableStateService<Row>();
            const before = state.query();

            state.setPage(1);
            state.setPageSize(GPO_TABLE_DEFAULT_PAGE_SIZE);
            state.setSort(null);
            state.setFilter(undefined);
            state.setFilter('   ');

            expect(state.query()).toBe(before);
        });

        it('повторная сортировка с теми же полями не меняет запрос', () => {
            const state = new GpoTableStateService<Row>();
            state.setSort({ field: 'name', direction: 'asc' });
            const before = state.query();

            state.setSort({ field: 'name', direction: 'asc' });

            expect(state.query()).toBe(before);
        });

        it('игнорирует некорректные страницу и размер', () => {
            const state = new GpoTableStateService<Row>();
            const before = state.query();

            state.setPage(0);
            state.setPage(Number.NaN);
            state.setPageSize(-1);

            expect(state.query()).toBe(before);
        });
    });

    describe('загрузка строк', () => {
        it('загружает строки и общее количество', async () => {
            const state = new GpoTableStateService<Row>();
            state.connect(createSource(async () => page([{ id: 1 }], 12)));

            await state.reload();

            expect(state.rows()).toEqual([{ id: 1 }]);
            expect(state.total()).toBe(12);
            expect(state.isLoading()).toBe(false);
            expect(state.error()).toBeNull();
            expect(state.hasRows()).toBe(true);
        });

        it('показывает ошибку, если источник не подключён', async () => {
            const state = new GpoTableStateService<Row>();

            await state.reload();

            expect(state.error()).toBe('Источник данных таблицы не подключён');
            expect(state.isLoading()).toBe(false);
        });

        it('показывает текст ошибки запроса и гасит загрузку', async () => {
            const state = new GpoTableStateService<Row>();
            state.connect(
                createSource(async () => {
                    throw new Error('Нет связи с сервером');
                }),
            );

            await state.reload();

            expect(state.error()).toBe('Нет связи с сервером');
            expect(state.isLoading()).toBe(false);
            expect(state.rows()).toEqual([]);
        });

        it('поздний ответ старого запроса не затирает свежие данные', async () => {
            const state = new GpoTableStateService<Row>();
            const calls: Deferred<GpoTablePage<Row>>[] = [];

            state.connect(
                createSource(() => {
                    const call = deferred<GpoTablePage<Row>>();
                    calls.push(call);
                    return call.promise;
                }),
            );

            const firstLoad = state.reload();
            state.setPage(2);
            const secondLoad = state.reload();

            calls[1].resolve(page([{ id: 2 }], 2));
            await secondLoad;
            expect(state.rows()).toEqual([{ id: 2 }]);

            calls[0].resolve(page([{ id: 1 }], 2));
            await firstLoad;

            expect(state.rows()).toEqual([{ id: 2 }]);
            expect(state.isLoading()).toBe(false);
        });

        it('ответ старого источника не применяется после смены источника', async () => {
            const state = new GpoTableStateService<Row>();
            const oldCall = deferred<GpoTablePage<Row>>();

            state.connect(createSource(() => oldCall.promise));
            const oldLoad = state.reload();

            state.connect(createSource(async () => page([{ id: 3 }], 3)));
            await state.reload();

            oldCall.resolve(page([{ id: 1 }], 1));
            await oldLoad;

            expect(state.rows()).toEqual([{ id: 3 }]);
            expect(state.total()).toBe(3);
        });

        it('пустая последняя страница переносит на последнюю существующую', async () => {
            const state = new GpoTableStateService<Row>();
            const requestedPages: number[] = [];

            state.connect(
                createSource(async (query) => {
                    requestedPages.push(query.page);
                    return query.page === 5 ? page([], 250) : page([{ id: 3 }], 250);
                }),
            );

            state.setPageSize(100);
            state.setPage(5);
            await state.reload();

            expect(requestedPages).toEqual([5, 3]);
            expect(state.page()).toBe(3);
            expect(state.rows()).toEqual([{ id: 3 }]);
        });
    });

    describe('подключение источника', () => {
        it('повторное подключение того же источника не сбрасывает страницу', () => {
            const state = new GpoTableStateService<Row>();
            const source = createSource(async () => page([]));
            state.connect(source);
            state.setPage(2);
            const before = state.query();

            state.connect(source);

            expect(state.query()).toBe(before);
        });

        it('новый источник очищает строки, итоги и возвращает на первую', async () => {
            const state = new GpoTableStateService<Row>();
            state.connect({
                getPage: async () => page([{ id: 1 }], 1),
                getAggregates: async () => ({ count: 1 }),
            });
            await state.reloadAll();
            state.setPage(2);

            state.connect(createSource(async () => page([{ id: 2 }], 2)));

            expect(state.rows()).toEqual([]);
            expect(state.total()).toBe(0);
            expect(state.aggregates()).toBeNull();
            expect(state.error()).toBeNull();
            expect(state.aggregatesError()).toBeNull();
            expect(state.page()).toBe(1);
        });
    });

    describe('агрегаты', () => {
        it('загружаются с тем же фильтром, что и строки', async () => {
            const state = new GpoTableStateService<Row, Totals>();
            let receivedFilter: string | undefined;

            state.connect({
                getPage: async () => page([], 0),
                getAggregates: async (query) => {
                    receivedFilter = query.filter;
                    return { count: 3 };
                },
            });
            state.setFilter('status=active');

            await state.reloadAll();

            expect(receivedFilter).toBe('status=active');
            expect(state.aggregates()).toEqual({ count: 3 });
            expect(state.isAggregatesLoading()).toBe(false);
            expect(state.aggregatesError()).toBeNull();
        });

        it('ответ агрегатов применяется после смены страницы и снимает загрузку', async () => {
            const state = new GpoTableStateService<Row, Totals>();
            const aggregatesCall = deferred<Totals>();

            state.connect({
                getPage: async () => page([{ id: 1 }], 1),
                getAggregates: () => aggregatesCall.promise,
            });

            const loadAll = state.reloadAll();
            state.setPage(2);
            await state.reload();
            expect(state.isAggregatesLoading()).toBe(true);

            aggregatesCall.resolve({ count: 3 });
            await loadAll;

            expect(state.aggregates()).toEqual({ count: 3 });
            expect(state.isAggregatesLoading()).toBe(false);
        });

        it('поздний ответ агрегатов старого фильтра не применяется', async () => {
            const state = new GpoTableStateService<Row, Totals>();
            const calls: Deferred<Totals>[] = [];

            state.connect({
                getPage: async () => page([], 0),
                getAggregates: () => {
                    const call = deferred<Totals>();
                    calls.push(call);
                    return call.promise;
                },
            });

            state.setFilter('status=active');
            const firstLoad = state.reloadAggregates();
            state.setFilter('status=blocked');
            const secondLoad = state.reloadAggregates();

            calls[1].resolve({ count: 2 });
            await secondLoad;

            calls[0].resolve({ count: 1 });
            await firstLoad;

            expect(state.aggregates()).toEqual({ count: 2 });
            expect(state.isAggregatesLoading()).toBe(false);
        });

        it('второй запрос агрегатов с тем же фильтром не снимает загрузку раньше времени', async () => {
            const state = new GpoTableStateService<Row, Totals>();
            const calls: Deferred<Totals>[] = [];

            state.connect({
                getPage: async () => page([], 0),
                getAggregates: () => {
                    const call = deferred<Totals>();
                    calls.push(call);
                    return call.promise;
                },
            });

            const firstLoad = state.reloadAggregates();
            const secondLoad = state.reloadAggregates();

            calls[0].resolve({ count: 1 });
            await firstLoad;
            expect(state.isAggregatesLoading()).toBe(true);

            calls[1].resolve({ count: 2 });
            await secondLoad;
            expect(state.aggregates()).toEqual({ count: 2 });
            expect(state.isAggregatesLoading()).toBe(false);
        });

        it('ошибка агрегатов не очищает строки', async () => {
            const state = new GpoTableStateService<Row, Totals>();

            state.connect({
                getPage: async () => page([{ id: 1 }], 1),
                getAggregates: async () => {
                    throw new Error('Итоги недоступны');
                },
            });

            await state.reloadAll();

            expect(state.rows()).toEqual([{ id: 1 }]);
            expect(state.aggregates()).toBeNull();
            expect(state.aggregatesError()).toBe('Итоги недоступны');
            expect(state.error()).toBeNull();
        });

        it('без getAggregates второго запроса нет', async () => {
            const state = new GpoTableStateService<Row>();
            let pageCalls = 0;

            state.connect(
                createSource(async () => {
                    pageCalls += 1;
                    return page([], 0);
                }),
            );

            await state.reloadAll();

            expect(pageCalls).toBe(1);
            expect(state.aggregates()).toBeNull();
            expect(state.isAggregatesLoading()).toBe(false);
        });
    });

    describe('isEmpty', () => {
        it('не пусто до первой загрузки и пусто после пустого ответа', async () => {
            const state = new GpoTableStateService<Row>();
            expect(state.isEmpty()).toBe(false);

            state.connect(createSource(async () => page([], 0)));
            await state.reload();

            expect(state.isEmpty()).toBe(true);
        });

        it('не пусто во время загрузки и при ошибке', async () => {
            const state = new GpoTableStateService<Row>();
            const call = deferred<GpoTablePage<Row>>();
            state.connect(createSource(() => call.promise));

            const loading = state.reload();
            expect(state.isEmpty()).toBe(false);

            call.resolve(page([{ id: 1 }]));
            await loading;
            expect(state.isEmpty()).toBe(false);

            const errorState = new GpoTableStateService<Row>();
            errorState.connect(
                createSource(async () => {
                    throw new Error('Ошибка');
                }),
            );
            await errorState.reload();
            expect(errorState.isEmpty()).toBe(false);
        });
    });
});

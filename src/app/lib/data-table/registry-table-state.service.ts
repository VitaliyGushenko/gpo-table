import { computed, Injectable, signal } from '@angular/core';

import { getErrorMessage } from './registry-table.helpers';
import { RegistryAggregates, RegistryDataSource, RegistryQuery, RegistrySort } from './registry-table.types';

/** Размер страницы по умолчанию для реестров */
export const REGISTRY_DEFAULT_PAGE_SIZE = 150;

/** Начальный запрос: первая страница, без фильтра и сортировки */
const DEFAULT_QUERY: RegistryQuery = {
    page: 1,
    pageSize: REGISTRY_DEFAULT_PAGE_SIZE,
    sort: null,
    filter: undefined,
};

/** Состояние одной таблицы реестра: запрос, строки, агрегаты */
@Injectable()
export class RegistryTableStateService<TRow extends object, TAggregates = RegistryAggregates> {
    /**
     * Единственный источник истины для запроса.
     * Каждое изменение заменяет объект целиком — старый объект становится устаревшим запросом.
     */
    readonly query = signal<RegistryQuery>(DEFAULT_QUERY);

    readonly page = computed(() => this.query().page);
    readonly pageSize = computed(() => this.query().pageSize);
    readonly sort = computed(() => this.query().sort);
    readonly filter = computed(() => this.query().filter);

    readonly rows = signal<readonly TRow[]>([]);
    readonly total = signal(0);
    readonly isLoading = signal(false);
    readonly error = signal<string | null>(null);
    readonly aggregates = signal<TAggregates | null>(null);
    readonly isAggregatesLoading = signal(false);
    readonly aggregatesError = signal<string | null>(null);

    private readonly _hasLoaded = signal(false);
    private _dataSource: RegistryDataSource<TRow, TAggregates> | null = null;
    private _aggregatesRequestId = 0;

    readonly hasRows = computed(() => this.rows().length > 0);
    readonly isEmpty = computed(
        () => this._hasLoaded() && !this.isLoading() && !this.hasRows() && !this.error(),
    );

    /** Подключить источник; вызывает только контейнер */
    connect(dataSource: RegistryDataSource<TRow, TAggregates>): void {
        if (dataSource === this._dataSource) {
            return;
        }
        this._dataSource = dataSource;
        // Другой источник — старые строки и агрегаты к нему не относятся
        this.rows.set([]);
        this.total.set(0);
        this.aggregates.set(null);
        this.error.set(null);
        this.aggregatesError.set(null);
        this.isAggregatesLoading.set(false);
        this._hasLoaded.set(false);
        // Новый объект запроса: ответы старого источника уже не актуальны
        this.query.update((query) => ({ ...query, page: 1 }));
    }

    /** Загрузить строки текущей страницы */
    async reload(): Promise<void> {
        return this._loadRows();
    }

    /** Загрузить агрегаты: тот же filter, что у строк; ошибка не ломает таблицу */
    async reloadAggregates(): Promise<void> {
        return this._loadAggregates();
    }

    /** Строки и агрегаты параллельно — при смене фильтра */
    async reloadAll(): Promise<void> {
        await Promise.all([this._loadRows(), this._loadAggregates()]);
    }

    setPage(page: number): void {
        if (!Number.isFinite(page) || page < 1 || page === this.query().page) {
            return;
        }
        this.query.update((query) => ({ ...query, page }));
    }

    /** Новый размер страницы всегда начинает с первой */
    setPageSize(pageSize: number): void {
        if (!Number.isFinite(pageSize) || pageSize < 1 || pageSize === this.query().pageSize) {
            return;
        }
        this.query.update((query) => ({ ...query, page: 1, pageSize }));
    }

    /** Новая сортировка всегда начинает с первой */
    setSort(sort: RegistrySort | null): void {
        const current = this.query().sort;
        if (current === sort) {
            return;
        }
        if (current && sort && current.field === sort.field && current.direction === sort.direction) {
            return;
        }
        this.query.update((query) => ({ ...query, page: 1, sort }));
    }

    /** Новый фильтр всегда начинает с первой */
    setFilter(filter?: string): void {
        const nextFilter = filter?.trim() || undefined;
        if (nextFilter === this.query().filter) {
            return;
        }
        this.query.update((query) => ({ ...query, page: 1, filter: nextFilter }));
    }

    private async _loadRows(): Promise<void> {
        const source = this._dataSource;
        if (!source) {
            this.error.set('Источник данных таблицы не подключён');
            return;
        }

        // Снимок запроса — по нему определяем, актуален ли ответ
        const query = this.query();
        this.isLoading.set(true);
        this.error.set(null);

        try {
            const page = await source.getPage(query);

            // Пока шёл запрос, пользователь изменил страницу/фильтр/сортировку —
            // этот ответ уже не показываем
            if (query !== this.query()) {
                return;
            }

            // Страница могла опустеть после удаления — переходим на последнюю
            if (page.rows.length === 0 && page.total > 0 && query.page > 1) {
                const lastPage = Math.max(1, Math.ceil(page.total / query.pageSize));
                if (lastPage !== query.page) {
                    this.query.update((current) => ({ ...current, page: lastPage }));
                    await this.reloadAll();
                    return;
                }
            }

            this.rows.set(page.rows);
            this.total.set(page.total);
        } catch (error) {
            if (query === this.query()) {
                this.error.set(getErrorMessage(error));
            }
        } finally {
            if (query === this.query()) {
                this.isLoading.set(false);
                this._hasLoaded.set(true);
            }
        }
    }

    private async _loadAggregates(): Promise<void> {
        const source = this._dataSource;
        if (!source?.getAggregates) {
            return;
        }

        // Агрегаты зависят только от фильтра: смена страницы или сортировки не отменяет ответ
        const query = this.query();
        const filter = query.filter;
        const requestId = ++this._aggregatesRequestId;
        this.isAggregatesLoading.set(true);
        this.aggregatesError.set(null);

        const isCurrent = (): boolean =>
            requestId === this._aggregatesRequestId &&
            source === this._dataSource &&
            filter === this.query().filter;

        try {
            const aggregates = await source.getAggregates(query);
            if (isCurrent()) {
                this.aggregates.set(aggregates);
            }
        } catch (error) {
            if (isCurrent()) {
                this.aggregates.set(null);
                this.aggregatesError.set(getErrorMessage(error));
            }
        } finally {
            if (isCurrent()) {
                this.isAggregatesLoading.set(false);
            }
        }
    }
}

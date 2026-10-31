import { firstValueFrom, Observable } from 'rxjs';

import {
    RegistryAggregates,
    RegistryDataSource,
    RegistryPage,
    RegistryQuery,
    RegistrySort,
} from '../registry-table.types';

/** Аргументы Gridify-метода swagger: страница, размер, сортировка и фильтр */
export interface SwaggerGridifyQuery {
    readonly page: number;
    readonly pageSize: number;
    readonly orderBy?: string;
    readonly filter?: string;
}

/** Ответ swagger-реестра: PagingOf… структурно совпадает с этой формой */
export interface SwaggerGridifyPage<TRow> {
    readonly count?: number;
    readonly data?: readonly TRow[];
}

/** Сортировка таблицы в строку Gridify для параметра OrderBy */
export function toGridifyOrderBy(sort: RegistrySort | null): string | undefined {
    return sort ? `${sort.field} ${sort.direction}` : undefined;
}

/**
 * Источник данных поверх сгенерированного swagger-клиента.
 * `loadPage` — метод /qry, `loadAggregates` — необязательный метод /aggregates.
 */
export function swaggerGridifyDataSource<TRow, TAggregates = RegistryAggregates>(
    loadPage: (query: SwaggerGridifyQuery) => Observable<SwaggerGridifyPage<TRow>>,
    loadAggregates?: (query: SwaggerGridifyQuery) => Observable<TAggregates>,
): RegistryDataSource<TRow, TAggregates> {
    const toSwaggerQuery = (query: RegistryQuery): SwaggerGridifyQuery => ({
        page: query.page,
        pageSize: query.pageSize,
        orderBy: toGridifyOrderBy(query.sort),
        filter: query.filter,
    });

    return {
        async getPage(query: RegistryQuery): Promise<RegistryPage<TRow>> {
            const response = await firstValueFrom(loadPage(toSwaggerQuery(query)));
            return { rows: response.data ?? [], total: response.count ?? 0 };
        },

        ...(loadAggregates
            ? {
                  async getAggregates(query: RegistryQuery): Promise<TAggregates> {
                      // Агрегатам нужен только фильтр: страница и сортировка не имеют смысла
                      return firstValueFrom(loadAggregates({ page: 1, pageSize: 1, filter: query.filter }));
                  },
              }
            : {}),
    };
}

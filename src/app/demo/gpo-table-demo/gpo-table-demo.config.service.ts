import { computed, Injectable, signal } from '@angular/core';

import { staticGridifyDataSource } from '../../lib/gpo-table/adapters/index';
import { GpoTableConfig } from '../../lib/gpo-table/core/gpo-table-config';
import { GpoTableColumn, GpoTableDataSource } from '../../lib/gpo-table/core/gpo-table.types';

type DemoRow = {
    id: number;
    name: string;
    category: string;
    count: number;
    amount: number;
    status: 'active' | 'blocked';
    createdAt: string;
};

type DemoAggregates = {
    count: number;
    amount: number;
};

const DEMO_CATEGORIES = ['Оборудование', 'Материалы', 'Услуги', 'Транспорт'];
const DEMO_STATUSES: readonly DemoRow['status'][] = ['active', 'active', 'blocked'];

const DEMO_ROWS: readonly DemoRow[] = Array.from({ length: 57 }, (_, index) => {
    const id = index + 1;
    const day = (index % 27) + 1;
    const month = index % 12;

    return {
        id,
        name: `Запись №${id}`,
        category: DEMO_CATEGORIES[index % DEMO_CATEGORIES.length],
        count: ((index * 7) % 50) + 1,
        amount: ((index * 137) % 9000) + 100.5,
        status: DEMO_STATUSES[index % DEMO_STATUSES.length],
        createdAt: new Date(Date.UTC(2026, month, day, 12)).toISOString(),
    };
});

/** Настройки демонстрационной таблицы реестра: данные, колонки и фильтр */
@Injectable()
export class GpoTableDemoConfigService implements GpoTableConfig<DemoRow, DemoAggregates> {
    readonly onlyActive = signal(false);
    readonly quickSearch = signal('');
    readonly fail = signal(false);
    /** Фильтр-функция: таблица перечитает её при изменении сигналов */
    readonly filter = computed(() => buildDemoFilter(this.onlyActive(), this.quickSearch()));

    readonly pageSize = 10;
    readonly bottomOffset = 16;
    readonly storageKey = 'gpo-table-demo';

    private readonly _staticSource = staticGridifyDataSource<DemoRow>(DEMO_ROWS, isDemoMatch);

    readonly dataSource: GpoTableDataSource<DemoRow, DemoAggregates> = {
        getPage: async (query) => {
            await wait(350);
            if (this.fail()) {
                throw new Error('Не удалось загрузить данные демонстрационной таблицы');
            }
            return this._staticSource.getPage(query);
        },
        getAggregates: async (query) => {
            await wait(200);
            if (this.fail()) {
                throw new Error('Не удалось загрузить итоги демонстрационной таблицы');
            }
            const matched = query.filter
                ? DEMO_ROWS.filter((row) => isDemoMatch(row, query.filter))
                : DEMO_ROWS;
            return {
                count: matched.length,
                amount: matched.reduce((sum, row) => sum + row.amount, 0),
            };
        },
    };

    readonly columns: GpoTableColumn<keyof DemoRow>[] = [
        { title: 'Наименование', field: 'name', isSortable: true, fixed: 'left' },
        {
            title: 'Категория',
            field: 'category',
            width: '170px',
            fixed: 'left',
            search: {
                kind: 'select',
                dictionary: DEMO_CATEGORIES.map((category) => ({
                    label: category,
                    value: category,
                })),
            },
        },
        {
            title: 'Количество',
            field: 'count',
            type: 'number',
            width: '130px',
            isSortable: true,
        },
        {
            title: 'Сумма, руб.',
            field: 'amount',
            type: 'number',
            width: '150px',
            isSortable: true,
            numberDigits: 2,
        },
        {
            title: 'Дата создания',
            field: 'createdAt',
            type: 'date',
            width: '150px',
            isSortable: true,
        },
        {
            title: 'Статус',
            field: 'status',
            type: 'template',
            width: '130px',
            align: 'center',
            search: false,
        },
        {
            title: '',
            field: 'id',
            type: 'template',
            width: '110px',
            align: 'center',
            search: false,
            fixed: 'right',
        },
    ];
}

/** Собрать простой фильтр демонстрации; настоящие страницы строят Gridify-строку своим билдером */
function buildDemoFilter(isOnlyActive: boolean, quickSearch: string): string | undefined {
    const parts: string[] = [];
    if (isOnlyActive) {
        parts.push('status=active');
    }
    const text = quickSearch.trim().toLowerCase().replace(/[,=]/g, ' ');
    if (text) {
        parts.push(`name_contains=${text}`);
    }
    return parts.length ? parts.join(',') : undefined;
}

/** Проверка строки для staticGridifyDataSource */
function isDemoMatch(row: DemoRow, filter?: string): boolean {
    const parts = (filter ?? '')
        .split(',')
        .map((part) => part.trim().replace(/^\(|\)$/g, ''))
        .filter(Boolean);

    return parts.every((part) => {
        if (part === 'status=active') {
            return row.status === 'active';
        }
        const prefix = 'name_contains=';
        return part.startsWith(prefix)
            ? row.name.toLowerCase().includes(part.slice(prefix.length))
            : true;
    });
}

function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

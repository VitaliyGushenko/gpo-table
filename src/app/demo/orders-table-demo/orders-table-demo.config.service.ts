import { Injectable } from '@angular/core';

import { staticGridifyDataSource } from '../../lib/gpo-table/adapters/index';
import { GpoTableConfig } from '../../lib/gpo-table/core/gpo-table-config';
import { GpoTableColumn, GpoTableDataSource } from '../../lib/gpo-table/core/gpo-table.types';

type OrderStatus = 'new' | 'processing' | 'done';

type OrderRow = {
    id: number;
    number: string;
    customer: string;
    items: number;
    total: number;
    createdAt: string;
    status: OrderStatus;
};

type OrderAggregates = {
    count: number;
    total: number;
};

const CUSTOMERS = [
    'ООО «Ромашка»',
    'АО «Вектор»',
    'ИП Соколов',
    'ООО «Северный ветер»',
    'ПАО «Гранит»',
    'ООО «ТехноПарк»',
];

const ORDER_STATUSES: readonly OrderStatus[] = ['new', 'processing', 'done', 'done'];

const ORDER_ROWS: readonly OrderRow[] = Array.from({ length: 53 }, (_, index) => {
    const id = index + 1;
    const items = ((index * 3) % 15) + 1;
    const total = items * 3490.5 + ((index * 731) % 8000);

    return {
        id,
        number: `ЗК-${1000 + id}`,
        customer: CUSTOMERS[(index * 5) % CUSTOMERS.length],
        items,
        total: Math.round(total * 100) / 100,
        createdAt: new Date(Date.UTC(2026, index % 12, (index % 27) + 1)).toISOString(),
        status: ORDER_STATUSES[index % ORDER_STATUSES.length],
    };
});

const ORDER_TOTAL = ORDER_ROWS.reduce((sum, row) => sum + row.total, 0);

/** Настройки демонстрационной таблицы заказов */
@Injectable()
export class OrdersTableDemoConfigService implements GpoTableConfig<OrderRow, OrderAggregates> {
    readonly pageSize = 10;
    readonly bottomOffset = 16;
    readonly storageKey = 'gpo-table-orders-demo';

    private readonly _source = staticGridifyDataSource<OrderRow>(ORDER_ROWS);

    readonly dataSource: GpoTableDataSource<OrderRow, OrderAggregates> = {
        getPage: (query) => this._source.getPage(query),
        getAggregates: async () => ({
            count: ORDER_ROWS.length,
            total: ORDER_TOTAL,
        }),
    };

    readonly columns: GpoTableColumn<keyof OrderRow>[] = [
        { title: '№ заказа', field: 'number', width: '130px', isSortable: true, fixed: 'left' },
        { title: 'Клиент', field: 'customer', isSortable: true },
        { title: 'Позиций', field: 'items', type: 'number', width: '110px' },
        {
            title: 'Сумма, руб.',
            field: 'total',
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
            width: '140px',
            align: 'center',
            search: false,
            fixed: 'right',
        },
    ];
}

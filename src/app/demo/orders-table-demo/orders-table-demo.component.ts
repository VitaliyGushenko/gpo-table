import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';

import { staticGridifyDataSource } from '../../lib/gpo-table/adapters/index';
import { GpoTableComponent } from '../../lib/gpo-table/components/gpo-table.component';
import { GpoTableCellDirective } from '../../lib/gpo-table/directives/gpo-table-cell.directive';
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

/** Демонстрационная таблица заказов на данных в памяти */
@Component({
    selector: 'app-orders-table-demo',
    standalone: true,
    host: { class: 'demo-page' },
    imports: [DecimalPipe, NzButtonModule, GpoTableCellDirective, GpoTableComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <gpo-table
            [dataSource]="dataSource"
            [columns]="columns"
            [pageSize]="10"
            [bottomOffset]="16"
            [storageKey]="'gpo-table-orders-demo'"
            [aggregatesTemplate]="aggregatesTemplate"
            (rowClick)="onRowClick($event)">
            <div gpoTableHeader class="demo-page__header">
                <div>
                    <h2 class="demo-page__title">Заказы</h2>
                    <div class="demo-page__hint">
                        Демо-данные: номера заказов, клиенты, суммы и статусы.
                    </div>
                </div>

                <div class="demo-page__actions">
                    <button nz-button (click)="reload()">Обновить</button>
                </div>
            </div>

            <ng-template gpoTableCell="status" let-value="value">
                @if (value === 'new') {
                    <span class="demo-page__badge demo-page__badge--blue">Новый</span>
                } @else if (value === 'processing') {
                    <span class="demo-page__badge demo-page__badge--orange">В работе</span>
                } @else {
                    <span class="demo-page__badge demo-page__badge--green">Выполнен</span>
                }
            </ng-template>

            <div gpoTableFooter class="demo-page__note">
                <span>{{ lastAction() }}</span>
                <span>Данные в памяти; ширины колонок запоминаются отдельно.</span>
            </div>
        </gpo-table>

        <ng-template #aggregatesTemplate let-aggregates let-isLoading="isLoading" let-error="error">
            @if (isLoading) {
                <span>Загрузка итогов…</span>
            } @else if (error) {
                <span class="demo-page__error">Не удалось загрузить итоги</span>
            } @else {
                <span>Заказов: <strong>{{ (aggregates?.['count'] ?? 0) | number: '1.0-0' }}</strong></span>
                <span>Сумма: <strong>{{ (aggregates?.['total'] ?? 0) | number: '1.2-2' }}</strong> руб.</span>
            }
        </ng-template>
    `,
})
export class OrdersTableDemoComponent {
    private readonly _source = staticGridifyDataSource<OrderRow>(ORDER_ROWS);
    private readonly _table = viewChild.required(GpoTableComponent);

    readonly lastAction = signal('Щёлкните строку — событие выбора придёт на страницу.');

    readonly dataSource: GpoTableDataSource<OrderRow, OrderAggregates> = {
        getPage: (query) => this._source.getPage(query),
        getAggregates: async () => ({
            count: ORDER_ROWS.length,
            total: ORDER_TOTAL,
        }),
    };

    readonly columns: GpoTableColumn<keyof OrderRow>[] = [
        { title: '№ заказа', field: 'number', width: '130px', isSortable: true },
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
        },
    ];

    reload(): void {
        void this._table().reload();
    }

    protected onRowClick(row: OrderRow): void {
        this.lastAction.set(`Выбран заказ: ${row.number}`);
    }
}

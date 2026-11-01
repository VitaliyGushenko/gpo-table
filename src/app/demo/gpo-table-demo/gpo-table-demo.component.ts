import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSwitchModule } from 'ng-zorro-antd/switch';

import { staticGridifyDataSource } from '../../lib/gpo-table/adapters/index';
import { GpoTableCellDirective } from '../../lib/gpo-table/directives/gpo-table-cell.directive';
import { GPO_TABLE_ACTIONS } from '../../lib/gpo-table/core/gpo-table-actions';
import { GpoTableComponent } from '../../lib/gpo-table/components/gpo-table.component';
import { GpoTableColumn, GpoTableDataSource } from '../../lib/gpo-table/core/gpo-table.types';
import { GpoTableDemoActionsService } from './gpo-table-demo-actions.service';

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

/** Демонстрационная страница таблицы реестра на данных в памяти */
@Component({
    selector: 'gpo-table-demo',
    standalone: true,
    imports: [
        DecimalPipe,
        FormsModule,
        NzButtonModule,
        NzInputModule,
        NzSwitchModule,
        GpoTableCellDirective,
        GpoTableComponent,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [
        GpoTableDemoActionsService,
        { provide: GPO_TABLE_ACTIONS, useExisting: GpoTableDemoActionsService },
    ],
    template: `
        <gpo-table
            [dataSource]="dataSource"
            [columns]="columns"
            [filter]="filter()"
            [pageSize]="10"
            [bottomOffset]="16"
            [storageKey]="'gpo-table-demo'"
            [aggregatesTemplate]="aggregatesTemplate"
            (rowClick)="onRowClick($event)"
            (rowDblClick)="onRowDblClick($event)">
            <div gpoTableHeader class="demo-toolbar">
                <div>
                    <h2 class="demo-toolbar__title">Реестр демонстрационных записей</h2>
                    <div class="demo-toolbar__hint">
                        Данные в памяти, запросы с задержкой; фильтр меняет Gridify-строку страницы.
                    </div>
                </div>

                <div class="demo-toolbar__actions">
                    <input
                        nz-input
                        class="demo-toolbar__search"
                        placeholder="Поиск по наименованию"
                        [ngModel]="quickSearch()"
                        (ngModelChange)="quickSearch.set($event)" />
                    <label class="demo-toolbar__switch">
                        <nz-switch
                            [ngModel]="onlyActive()"
                            (ngModelChange)="onlyActive.set($event)"></nz-switch>
                        Только активные
                    </label>
                    <label class="demo-toolbar__switch">
                        <nz-switch
                            [ngModel]="canEdit()"
                            (ngModelChange)="canEdit.set($event)"></nz-switch>
                        Права на редактирование
                    </label>
                    <button nz-button (click)="reload()">Обновить</button>
                    <button nz-button (click)="resetWidths()">Сбросить ширины</button>
                    <button nz-button [nzDanger]="fail()" (click)="toggleFail()">
                        {{ fail() ? 'Скрыть ошибку' : 'Показать ошибку' }}
                    </button>
                </div>
            </div>

            <ng-template gpoTableCell="status" let-value="value">
                @if (value === 'active') {
                    <span class="demo-status demo-status--active">Активен</span>
                } @else {
                    <span class="demo-status demo-status--blocked">Заблокирован</span>
                }
            </ng-template>

            <ng-template gpoTableCell="id" let-row>
                <button nz-button nzSize="small" (click)="$event.stopPropagation(); openRow(row)">Открыть</button>
            </ng-template>

            <div gpoTableFooter class="demo-note">
                <span>{{ lastAction() }}</span>
                <span>Щёлкните строку или дважды щёлкните по ней — событие придёт на страницу.</span>
            </div>
        </gpo-table>

        <ng-template #aggregatesTemplate let-aggregates let-isLoading="isLoading" let-error="error">
            @if (isLoading) {
                <span>Загрузка итогов…</span>
            } @else if (error) {
                <span class="demo-note__error">Не удалось загрузить итоги</span>
            } @else {
                <span>Всего записей: <strong>{{ (aggregates?.['count'] ?? 0) | number: '1.0-0' }}</strong></span>
                <span>Сумма: <strong>{{ (aggregates?.['amount'] ?? 0) | number: '1.2-2' }}</strong> руб.</span>
            }
        </ng-template>
    `,
    styles: [
        `
            :host {
                display: block;
                padding: 16px;
            }

            .demo-toolbar {
                display: flex;
                flex-wrap: wrap;
                align-items: flex-end;
                justify-content: space-between;
                gap: 12px;
                margin-bottom: 12px;
            }

            .demo-toolbar__title {
                margin: 0 0 4px;
                font-size: 18px;
            }

            .demo-toolbar__hint {
                color: rgb(0 0 0 / 55%);
                font-size: 12px;
            }

            .demo-toolbar__actions {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 8px;
            }

            .demo-toolbar__search {
                width: 240px;
            }

            .demo-toolbar__switch {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                margin: 0;
                white-space: nowrap;
            }

            .demo-status {
                display: inline-block;
                padding: 1px 8px;
                border-radius: 10px;
                font-size: 12px;
            }

            .demo-status--active {
                background: #f6ffed;
                color: #389e0d;
            }

            .demo-status--blocked {
                background: #fff1f0;
                color: #cf1322;
            }

            .demo-note {
                display: flex;
                flex-wrap: wrap;
                justify-content: space-between;
                gap: 12px;
                padding-top: 8px;
                color: rgb(0 0 0 / 55%);
                font-size: 12px;
            }

            .demo-note__error {
                color: #cf1322;
            }
        `,
    ],
})
export class GpoTableDemoComponent {
    private readonly _actions = inject(GpoTableDemoActionsService);

    readonly onlyActive = signal(false);
    readonly quickSearch = signal('');
    readonly fail = signal(false);
    readonly lastAction = this._actions.lastAction;
    readonly canEdit = this._actions.isEdit;
    readonly filter = computed(() => buildDemoFilter(this.onlyActive(), this.quickSearch()));

    private readonly _staticSource = staticGridifyDataSource<DemoRow>(DEMO_ROWS, isDemoMatch);
    private readonly _table = viewChild.required(GpoTableComponent);

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
            const matched = query.filter ? DEMO_ROWS.filter((row) => isDemoMatch(row, query.filter)) : DEMO_ROWS;
            return {
                count: matched.length,
                amount: matched.reduce((sum, row) => sum + row.amount, 0),
            };
        },
    };

    readonly columns: GpoTableColumn<keyof DemoRow>[] = [
        { title: 'Наименование', field: 'name', isSortable: true },
        {
            title: 'Категория',
            field: 'category',
            width: '170px',
            search: {
                kind: 'select',
                dictionary: DEMO_CATEGORIES.map((category) => ({ label: category, value: category })),
            },
        },
        { title: 'Количество', field: 'count', type: 'number', width: '130px', isSortable: true },
        { title: 'Сумма, руб.', field: 'amount', type: 'number', width: '150px', isSortable: true, numberDigits: 2 },
        { title: 'Дата создания', field: 'createdAt', type: 'date', width: '150px', isSortable: true },
        {
            title: 'Статус',
            field: 'status',
            type: 'template',
            width: '130px',
            align: 'center',
            search: false,
        },
        { title: '', field: 'id', type: 'template', width: '110px', align: 'center', search: false },
    ];

    reload(): void {
        void this._table().reload();
    }

    resetWidths(): void {
        this._table().resetColumnWidths();
    }

    toggleFail(): void {
        this.fail.update((value) => !value);
        this.reload();
    }

    onRowClick(row: Record<string, unknown>): void {
        this.lastAction.set(`Открыта запись: ${row['name']}`);
    }

    onRowDblClick(row: Record<string, unknown>): void {
        this.lastAction.set(`Двойной щелчок: ${row['name']}`);
    }

    openRow(row: Record<string, unknown>): void {
        this.lastAction.set(`Кнопка «Открыть»: ${row['name']}`);
    }
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
    const parts = (filter ?? '').split(',').filter(Boolean);

    return parts.every((part) => {
        if (part === 'status=active') {
            return row.status === 'active';
        }
        const prefix = 'name_contains=';
        return part.startsWith(prefix) ? row.name.toLowerCase().includes(part.slice(prefix.length)) : true;
    });
}

function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';

import { staticGridifyDataSource } from '../../lib/gpo-table/adapters/index';
import { GpoTableComponent } from '../../lib/gpo-table/components/gpo-table.component';
import { GpoTableCellDirective } from '../../lib/gpo-table/directives/gpo-table-cell.directive';
import { GpoTableColumn, GpoTableDataSource } from '../../lib/gpo-table/core/gpo-table.types';

type EmployeeStatus = 'active' | 'vacation' | 'dismissed';

type EmployeeRow = {
    id: number;
    fullName: string;
    position: string;
    department: string;
    salary: number;
    hiredAt: string;
    status: EmployeeStatus;
};

type EmployeeAggregates = {
    count: number;
    salary: number;
};

const LAST_NAMES = [
    'Смирнов',
    'Иванова',
    'Кузнецов',
    'Петрова',
    'Соколов',
    'Попова',
    'Лебедев',
    'Новикова',
    'Морозов',
    'Волкова',
];

const FIRST_NAMES = [
    'Алексей',
    'Мария',
    'Дмитрий',
    'Анна',
    'Сергей',
    'Ольга',
    'Павел',
    'Елена',
    'Артём',
    'Ирина',
];

const POSITIONS = [
    'Ведущий разработчик',
    'Системный аналитик',
    'Менеджер проектов',
    'Бухгалтер',
    'UX-дизайнер',
    'Тестировщик',
];

const DEPARTMENTS = ['Разработка', 'Аналитика', 'Продажи', 'Бухгалтерия', 'Дизайн', 'QA'];

const EMPLOYEE_STATUSES: readonly EmployeeStatus[] = [
    'active',
    'active',
    'vacation',
    'active',
    'dismissed',
];

const EMPLOYEE_ROWS: readonly EmployeeRow[] = Array.from({ length: 46 }, (_, index) => {
    const id = index + 1;
    const year = 2016 + (index % 9);
    const salary = 60000 + ((index * 7919) % 180000);

    return {
        id,
        fullName: `${LAST_NAMES[index % LAST_NAMES.length]} ${FIRST_NAMES[(index * 3) % FIRST_NAMES.length]}`,
        position: POSITIONS[(index * 5) % POSITIONS.length],
        department: DEPARTMENTS[(index * 7) % DEPARTMENTS.length],
        salary: Math.round(salary / 1000) * 1000,
        hiredAt: new Date(Date.UTC(year, index % 12, (index % 27) + 1)).toISOString(),
        status: EMPLOYEE_STATUSES[index % EMPLOYEE_STATUSES.length],
    };
});

const EMPLOYEE_SALARY_TOTAL = EMPLOYEE_ROWS.reduce((sum, row) => sum + row.salary, 0);

/** Демонстрационная таблица сотрудников на данных в памяти */
@Component({
    selector: 'app-employees-table-demo',
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
            [storageKey]="'gpo-table-employees-demo'"
            [aggregatesTemplate]="aggregatesTemplate"
            (rowClick)="onRowClick($event)">
            <div gpoTableHeader class="demo-page__header">
                <div>
                    <h2 class="demo-page__title">Сотрудники</h2>
                    <div class="demo-page__hint">
                        Демо-данные: сотрудники, отделы, оклады и статусы.
                    </div>
                </div>

                <div class="demo-page__actions">
                    <button nz-button (click)="reload()">Обновить</button>
                </div>
            </div>

            <ng-template gpoTableCell="status" let-value="value">
                @if (value === 'active') {
                    <span class="demo-page__badge demo-page__badge--green">Работает</span>
                } @else if (value === 'vacation') {
                    <span class="demo-page__badge demo-page__badge--blue">В отпуске</span>
                } @else {
                    <span class="demo-page__badge demo-page__badge--gray">Уволен</span>
                }
            </ng-template>

            <div gpoTableFooter class="demo-page__note">
                <span>{{ lastAction() }}</span>
                <span>Ширины колонок запоминаются отдельно для этой таблицы.</span>
            </div>
        </gpo-table>

        <ng-template #aggregatesTemplate let-aggregates let-isLoading="isLoading" let-error="error">
            @if (isLoading) {
                <span>Загрузка итогов…</span>
            } @else if (error) {
                <span class="demo-page__error">Не удалось загрузить итоги</span>
            } @else {
                <span>Сотрудников: <strong>{{ (aggregates?.['count'] ?? 0) | number: '1.0-0' }}</strong></span>
                <span>Фонд оплаты: <strong>{{ (aggregates?.['salary'] ?? 0) | number: '1.0-0' }}</strong> руб.</span>
            }
        </ng-template>
    `,
})
export class EmployeesTableDemoComponent {
    private readonly _source = staticGridifyDataSource<EmployeeRow>(EMPLOYEE_ROWS);
    private readonly _table = viewChild.required(GpoTableComponent);

    readonly lastAction = signal('Щёлкните строку — событие выбора придёт на страницу.');

    readonly dataSource: GpoTableDataSource<EmployeeRow, EmployeeAggregates> = {
        getPage: (query) => this._source.getPage(query),
        getAggregates: async () => ({
            count: EMPLOYEE_ROWS.length,
            salary: EMPLOYEE_SALARY_TOTAL,
        }),
    };

    readonly columns: GpoTableColumn<keyof EmployeeRow>[] = [
        { title: 'ФИО', field: 'fullName', isSortable: true },
        {
            title: 'Должность',
            field: 'position',
            width: '200px',
            search: {
                kind: 'select',
                dictionary: POSITIONS.map((position) => ({ label: position, value: position })),
            },
        },
        {
            title: 'Отдел',
            field: 'department',
            width: '160px',
            search: {
                kind: 'select',
                dictionary: DEPARTMENTS.map((department) => ({
                    label: department,
                    value: department,
                })),
            },
        },
        {
            title: 'Оклад, руб.',
            field: 'salary',
            type: 'number',
            width: '150px',
            isSortable: true,
            numberDigits: 0,
        },
        {
            title: 'Дата приёма',
            field: 'hiredAt',
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

    protected onRowClick(row: EmployeeRow): void {
        this.lastAction.set(`Выбран сотрудник: ${row.fullName}`);
    }
}

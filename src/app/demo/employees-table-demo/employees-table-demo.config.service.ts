import { Injectable } from '@angular/core';

import { staticGridifyDataSource } from '../../lib/gpo-table/adapters/index';
import { GpoTableConfig } from '../../lib/gpo-table/core/gpo-table-config';
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

/** Настройки демонстрационной таблицы сотрудников */
@Injectable()
export class EmployeesTableDemoConfigService implements GpoTableConfig<EmployeeRow, EmployeeAggregates> {
    readonly pageSize = 10;
    readonly bottomOffset = 16;
    readonly storageKey = 'gpo-table-employees-demo';

    private readonly _source = staticGridifyDataSource<EmployeeRow>(EMPLOYEE_ROWS);

    readonly dataSource: GpoTableDataSource<EmployeeRow, EmployeeAggregates> = {
        getPage: (query) => this._source.getPage(query),
        getAggregates: async () => ({
            count: EMPLOYEE_ROWS.length,
            salary: EMPLOYEE_SALARY_TOTAL,
        }),
    };

    readonly columns: GpoTableColumn<keyof EmployeeRow>[] = [
        { title: 'ФИО', field: 'fullName', isSortable: true, fixed: 'left' },
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
            fixed: 'right',
        },
    ];
}

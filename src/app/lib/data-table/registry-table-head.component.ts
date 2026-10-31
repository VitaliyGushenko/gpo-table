import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { RegistryColumn, RegistrySort } from './registry-table.types';

/** Шапка таблицы реестра: заголовки и сортировка */
@Component({
    selector: 'thead[app-registry-table-head]',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <tr>
            @for (column of columns(); track $index) {
                <th
                    [style.width]="column.width"
                    [style.text-align]="getAlign(column)"
                    [class]="column.cssClass ?? ''"
                    [attr.aria-sort]="getAriaSort(column)">
                    @if (column.isSortable) {
                        <button
                            type="button"
                            class="registry-table__sort"
                            [attr.aria-label]="'Сортировать: ' + column.title"
                            (click)="toggleSort(column)">
                            <span class="registry-table__sort-title">{{ column.title }}</span>
                            <span class="registry-table__sorter" aria-hidden="true">
                                <span
                                    class="registry-table__sorter-arrow"
                                    [class.registry-table__sorter-arrow--active]="isSortActive(column, 'asc')">
                                    ▲
                                </span>
                                <span
                                    class="registry-table__sorter-arrow"
                                    [class.registry-table__sorter-arrow--active]="isSortActive(column, 'desc')">
                                    ▼
                                </span>
                            </span>
                        </button>
                    } @else {
                        {{ column.title }}
                    }
                </th>
            }
        </tr>
    `,
    styles: [
        `
            th {
                white-space: nowrap;
            }

            .registry-table__sort {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                width: 100%;
                padding: 0;
                border: 0;
                background: none;
                color: inherit;
                font: inherit;
                text-align: inherit;
                cursor: pointer;
            }

            .registry-table__sort-title {
                flex: 1;
                min-width: 0;
            }

            .registry-table__sorter {
                display: inline-flex;
                flex-direction: column;
                flex: 0 0 auto;
                gap: 1px;
                line-height: 1;
            }

            .registry-table__sorter-arrow {
                display: block;
                padding: 0 2px;
                border-radius: 2px;
                color: rgb(0 0 0 / 25%);
                font-size: 8px;
                line-height: 8px;
                transition:
                    color 0.2s,
                    background-color 0.2s;
            }

            .registry-table__sorter-arrow--active {
                background: #e6f4ff;
                color: #1677ff;
            }
        `,
    ],
})
export class RegistryTableHeadComponent {
    /** Видимые колонки */
    readonly columns = input.required<readonly RegistryColumn[]>();

    /** Текущая сортировка */
    readonly sort = input<RegistrySort | null>(null);

    /** Клик по сортируемой колонке: asc → desc → без сортировки */
    readonly sortChange = output<RegistrySort | null>();

    protected getAlign(column: RegistryColumn): string {
        return column.align ?? (column.type === 'number' ? 'right' : 'left');
    }

    /** Активна ли стрелка указанного направления */
    protected isSortActive(column: RegistryColumn, direction: 'asc' | 'desc'): boolean {
        const sort = this.sort();
        return sort?.field === column.field && sort.direction === direction;
    }

    protected getAriaSort(column: RegistryColumn): string | null {
        const sort = this.sort();
        if (!column.isSortable) {
            return null;
        }
        if (sort?.field !== column.field) {
            return 'none';
        }
        return sort.direction === 'asc' ? 'ascending' : 'descending';
    }

    protected toggleSort(column: RegistryColumn): void {
        const sort = this.sort();
        if (sort?.field !== column.field) {
            this.sortChange.emit({ field: column.field, direction: 'asc' });
            return;
        }
        if (sort.direction === 'asc') {
            this.sortChange.emit({ field: column.field, direction: 'desc' });
            return;
        }
        this.sortChange.emit(null);
    }
}

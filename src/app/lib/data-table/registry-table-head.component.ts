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
                        <button type="button" class="registry-table__sort" (click)="toggleSort(column)">
                            {{ column.title }}
                            <span class="registry-table__sort-icon" aria-hidden="true">{{ getSortIcon(column) }}</span>
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
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 0;
                border: 0;
                background: none;
                color: inherit;
                font: inherit;
                cursor: pointer;
            }

            .registry-table__sort-icon {
                font-size: 10px;
                line-height: 1;
                opacity: 0.7;
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

    /** Индикатор сортировки: нет — ↕, по возрастанию — ▲, по убыванию — ▼ */
    protected getSortIcon(column: RegistryColumn): string {
        const sort = this.sort();
        if (sort?.field !== column.field) {
            return '↕';
        }
        return sort.direction === 'asc' ? '▲' : '▼';
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

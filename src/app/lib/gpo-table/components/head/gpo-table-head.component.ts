import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { GpoTableColumnResizeDirective } from '../../directives/gpo-table-column-resize.directive';
import { GpoTableColumn, GpoTableColumnResize, GpoTableSort } from '../../core/gpo-table.types';

/** Шапка таблицы реестра: заголовки, сортировка и resize колонок */
@Component({
    selector: 'thead[gpo-table-head]',
    standalone: true,
    imports: [GpoTableColumnResizeDirective],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <tr>
            @if (hasActions()) {
                <th class="gpo-table__actions-head" aria-label="Действия"></th>
            }

            @for (column of columns(); track $index) {
                <th
                    [style.width]="column.width"
                    [style.text-align]="getAlign(column)"
                    [class]="column.cssClass ?? ''"
                    [attr.aria-sort]="getAriaSort(column)">
                    @if (column.isSortable) {
                        <button
                            type="button"
                            class="gpo-table__sort"
                            [attr.aria-label]="'Сортировать: ' + column.title"
                            (click)="toggleSort(column)">
                            <span class="gpo-table__sort-title">{{ column.title }}</span>
                            <span class="gpo-table__sorter" aria-hidden="true">
                                <span
                                    class="gpo-table__sorter-arrow"
                                    [class.gpo-table__sorter-arrow--active]="isSortActive(column, 'asc')">
                                    ▲
                                </span>
                                <span
                                    class="gpo-table__sorter-arrow"
                                    [class.gpo-table__sorter-arrow--active]="isSortActive(column, 'desc')">
                                    ▼
                                </span>
                            </span>
                        </button>
                    } @else {
                        {{ column.title }}
                    }

                    @if (column.isResizable !== false) {
                        <span
                            gpoTableColumnResize
                            class="gpo-table__resize"
                            [attr.aria-label]="'Изменить ширину: ' + column.title"
                            (widthChange)="onColumnResize(column, $event)"></span>
                    }
                </th>
            }
        </tr>
    `,
    styles: [
        `
            th {
                position: relative;
                white-space: nowrap;
            }

            .gpo-table__actions-head {
                width: 64px;
                text-align: center;
            }

            .gpo-table__resize {
                position: absolute;
                top: 0;
                right: 0;
                bottom: 0;
                z-index: 2;
                width: 8px;
                cursor: col-resize;
                touch-action: none;
            }

            .gpo-table__resize::after {
                position: absolute;
                top: 25%;
                bottom: 25%;
                left: 3px;
                width: 1px;
                background: transparent;
                content: '';
                transition: background-color 0.2s;
            }

            .gpo-table__resize:hover::after,
            .gpo-table__resize:focus-visible::after {
                background: #1677ff;
            }

            .gpo-table__sort {
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

            .gpo-table__sort-title {
                flex: 1;
                min-width: 0;
            }

            .gpo-table__sorter {
                display: inline-flex;
                flex-direction: column;
                flex: 0 0 auto;
                gap: 1px;
                line-height: 1;
            }

            .gpo-table__sorter-arrow {
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

            .gpo-table__sorter-arrow--active {
                background: #e6f4ff;
                color: #1677ff;
            }
        `,
    ],
})
export class GpoTableHeadComponent {
    /** Видимые колонки */
    readonly columns = input.required<readonly GpoTableColumn[]>();

    /** Показывать первую колонку действий */
    readonly hasActions = input(false);

    /** Текущая сортировка */
    readonly sort = input<GpoTableSort | null>(null);

    /** Клик по сортируемой колонке: asc → desc → без сортировки */
    readonly sortChange = output<GpoTableSort | null>();

    /** Изменение ширины колонки */
    readonly columnResize = output<GpoTableColumnResize>();

    protected getAlign(column: GpoTableColumn): string {
        return column.align ?? (column.type === 'number' ? 'right' : 'left');
    }

    /** Активна ли стрелка указанного направления */
    protected isSortActive(column: GpoTableColumn, direction: 'asc' | 'desc'): boolean {
        const sort = this.sort();
        return sort?.field === column.field && sort.direction === direction;
    }

    protected getAriaSort(column: GpoTableColumn): string | null {
        const sort = this.sort();
        if (!column.isSortable) {
            return null;
        }
        if (sort?.field !== column.field) {
            return 'none';
        }
        return sort.direction === 'asc' ? 'ascending' : 'descending';
    }

    protected toggleSort(column: GpoTableColumn): void {
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

    protected onColumnResize(column: GpoTableColumn, width: number): void {
        this.columnResize.emit({ field: column.field, width });
    }
}

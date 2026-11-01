import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, LOCALE_ID } from '@angular/core';

import { formatGpoTableValue, readGpoTableValue } from '../../core/gpo-table.helpers';
import { GpoTableRowActionsComponent } from './gpo-table-row-actions.component';
import {
    GpoTableCellContext,
    GpoTableCellTemplate,
    GpoTableColumn,
    GpoTablePinnedOffsets,
} from '../../core/gpo-table.types';

/** Готовая ячейка: текст, шаблон и оформление посчитаны один раз на строку */
interface GpoTableCellView {
    readonly column: GpoTableColumn;
    readonly text: string;
    readonly template: GpoTableCellTemplate | null;
    readonly context: GpoTableCellContext<Record<string, unknown>>;
    readonly align: 'left' | 'center' | 'right';
    readonly className: string;
    readonly title: string;
}

/** Строка таблицы реестра: ячейки по типу колонки или шаблону */
@Component({
    selector: 'tr[gpo-table-row]',
    standalone: true,
    imports: [NgTemplateOutlet, GpoTableRowActionsComponent],
    host: { class: 'ant-table-row' },
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        @if (hasActions()) {
            <td
                class="gpo-table__actions-cell gpo-table__pinned gpo-table__pinned-left"
                [style.left.px]="0"
                (click)="$event.stopPropagation()">
                <gpo-table-row-actions [row]="rowRecord()"></gpo-table-row-actions>
            </td>
        }

        @for (cell of cells(); track $index) {
            <td
                [class]="cell.className"
                [style.text-align]="cell.align"
                [style.left.px]="
                    cell.column.fixed === 'left'
                        ? (pinnedOffsets().get(cell.column.field)?.left ?? null)
                        : null
                "
                [style.right.px]="
                    cell.column.fixed === 'right'
                        ? (pinnedOffsets().get(cell.column.field)?.right ?? null)
                        : null
                "
                [title]="cell.title">
                @if (cell.template) {
                    <ng-container
                        [ngTemplateOutlet]="cell.template"
                        [ngTemplateOutletContext]="cell.context"></ng-container>
                } @else {
                    {{ cell.text }}
                }
            </td>
        }
    `,
    styles: [
        `
            .gpo-table__actions-cell {
                width: 64px;
                padding: 0;
                text-align: center;
            }
        `,
    ],
})
export class GpoTableRowComponent<TRow extends object = Record<string, unknown>> {
    readonly row = input.required<TRow>();
    readonly index = input.required<number>();
    readonly columns = input.required<readonly GpoTableColumn[]>();
    readonly templates = input.required<ReadonlyMap<string, GpoTableCellTemplate>>();
    readonly hasActions = input(false);
    readonly pinnedOffsets = input<GpoTablePinnedOffsets>(new Map());

    // Локаль приходит из приложения: в рабочем проекте — ru, в пустом — en-US
    private readonly _locale = inject(LOCALE_ID);

    /** Строка для встроенного меню действий: таблица не знает DTO страницы */
    protected readonly rowRecord = computed(() => this.row() as unknown as Record<string, unknown>);

    protected readonly cells = computed<GpoTableCellView[]>(() =>
        this.columns().map((column) => this.prepareCell(column)),
    );

    private prepareCell(column: GpoTableColumn): GpoTableCellView {
        const value = readGpoTableValue(this.row(), column.field);
        const type = column.type ?? 'text';
        const template = this.templates().get(column.field) ?? null;

        // Таблица не знает DTO строки: шаблон получает запись полей
        const row = this.row() as unknown as Record<string, unknown>;
        const text = formatGpoTableValue(value, column, this._locale);
        const classes = [column.cssClass ?? ''];
        if (column.fixed) {
            classes.push('gpo-table__pinned', `gpo-table__pinned-${column.fixed}`);
        }

        return {
            column,
            text,
            template,
            context: {
                $implicit: row,
                row,
                value,
                column,
                index: this.index(),
            },
            align: column.align ?? (type === 'number' ? 'right' : 'left'),
            className: classes.filter(Boolean).join(' '),
            title: template ? '' : text,
        };
    }
}

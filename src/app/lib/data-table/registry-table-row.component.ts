import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, LOCALE_ID } from '@angular/core';

import { formatRegistryValue, readRegistryValue } from './registry-table.helpers';
import { RegistryTableRowActionsComponent } from './registry-table-row-actions.component';
import {
    RegistryCellContext,
    RegistryCellTemplate,
    RegistryColumn,
} from './registry-table.types';

/** Готовая ячейка: текст, шаблон и оформление посчитаны один раз на строку */
interface RegistryCellView {
    readonly column: RegistryColumn;
    readonly text: string;
    readonly template: RegistryCellTemplate | null;
    readonly context: RegistryCellContext<Record<string, unknown>>;
    readonly align: 'left' | 'center' | 'right';
    readonly className: string;
    readonly title: string;
}

/** Строка таблицы реестра: ячейки по типу колонки или шаблону */
@Component({
    selector: 'tr[app-registry-table-row]',
    standalone: true,
    imports: [NgTemplateOutlet, RegistryTableRowActionsComponent],
    host: { class: 'ant-table-row' },
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        @if (hasActions()) {
            <td class="registry-table__actions-cell" (click)="$event.stopPropagation()">
                <app-registry-table-row-actions [row]="rowRecord()"></app-registry-table-row-actions>
            </td>
        }

        @for (cell of cells(); track $index) {
            <td [class]="cell.className" [style.text-align]="cell.align" [title]="cell.title">
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
            .registry-table__actions-cell {
                width: 64px;
                text-align: center;
            }
        `,
    ],
})
export class RegistryTableRowComponent<TRow extends object = Record<string, unknown>> {
    readonly row = input.required<TRow>();
    readonly index = input.required<number>();
    readonly columns = input.required<readonly RegistryColumn[]>();
    readonly templates = input.required<ReadonlyMap<string, RegistryCellTemplate>>();
    readonly hasActions = input(false);

    // Локаль приходит из приложения: в рабочем проекте — ru, в пустом — en-US
    private readonly _locale = inject(LOCALE_ID);

    /** Строка для встроенного меню действий: таблица не знает DTO страницы */
    protected readonly rowRecord = computed(() => this.row() as unknown as Record<string, unknown>);

    protected readonly cells = computed<RegistryCellView[]>(() =>
        this.columns().map((column) => this.prepareCell(column)),
    );

    private prepareCell(column: RegistryColumn): RegistryCellView {
        const value = readRegistryValue(this.row(), column.field);
        const type = column.type ?? 'text';
        const template = this.templates().get(column.field) ?? null;

        // Таблица не знает DTO строки: шаблон получает запись полей
        const row = this.row() as unknown as Record<string, unknown>;
        const text = formatRegistryValue(value, column, this._locale);

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
            className: column.cssClass ?? '',
            title: template ? '' : text,
        };
    }
}

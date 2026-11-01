import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSpinModule } from 'ng-zorro-antd/spin';

import { readGpoTableValue } from '../../core/gpo-table.helpers';
import { GpoTableRowComponent } from '../row/gpo-table-row.component';
import { GpoTableCellTemplate, GpoTableColumn } from '../../core/gpo-table.types';

/** Тело таблицы реестра: состояния загрузки/пустоты/ошибки и строки */
@Component({
    selector: 'tbody[gpo-table-body]',
    standalone: true,
    imports: [NzButtonModule, NzEmptyModule, NzSpinModule, GpoTableRowComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        @if (error()) {
            <tr class="gpo-table__state-row">
                <td [attr.colspan]="getColspan()">
                    <div class="gpo-table__state" role="alert" aria-live="assertive">
                        <span>{{ error() }}</span>
                        <button nz-button nzSize="small" (click)="retry.emit()">Повторить</button>
                    </div>
                </td>
            </tr>
        } @else if (isLoading() && !rows().length) {
            <tr class="gpo-table__state-row">
                <td [attr.colspan]="getColspan()">
                    <div class="gpo-table__state" role="status" aria-live="polite">
                        <nz-spin nzSimple nzSize="small"></nz-spin>
                        <span>Загрузка данных</span>
                    </div>
                </td>
            </tr>
        } @else if (!rows().length) {
            <tr class="gpo-table__state-row">
                <td [attr.colspan]="getColspan()">
                    <div role="status" aria-live="polite">
                        <nz-empty [nzNotFoundContent]="emptyText()"></nz-empty>
                    </div>
                </td>
            </tr>
        } @else {
            @for (row of rows(); track trackRow($index, row)) {
                <tr
                    gpo-table-row
                    tabindex="0"
                    [row]="row"
                    [index]="$index"
                    [columns]="columns()"
                    [templates]="templates()"
                    [hasActions]="hasActions()"
                    (click)="rowClick.emit(row)"
                    (dblclick)="rowDblClick.emit(row)"
                    (keydown.enter)="onRowKeydown($event, row)"></tr>
            }
        }
    `,
    styles: [
        `
            .gpo-table__state {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                min-height: 120px;
            }

            .gpo-table__state-row > td {
                white-space: normal;
            }
        `,
    ],
})
export class GpoTableBodyComponent<TRow extends object = Record<string, unknown>> {
    readonly columns = input.required<readonly GpoTableColumn[]>();
    readonly rows = input.required<readonly TRow[]>();
    readonly templates = input.required<ReadonlyMap<string, GpoTableCellTemplate>>();
    readonly rowKey = input('id');
    readonly isLoading = input(false);
    readonly error = input<string | null>(null);
    readonly emptyText = input('Данные не найдены');
    readonly hasActions = input(false);

    readonly rowClick = output<TRow>();
    readonly rowDblClick = output<TRow>();
    readonly retry = output<void>();

    /** Устойчивый ключ строки; при отсутствии rowKey — индекс */
    protected trackRow(index: number, row: TRow): unknown {
        return readGpoTableValue(row, this.rowKey()) ?? index;
    }

    protected getColspan(): number {
        return this.columns().length + (this.hasActions() ? 1 : 0);
    }

    /** Enter на самой строке открывает её; Enter внутри кнопки/ссылки не дублирует клик */
    protected onRowKeydown(event: Event, row: TRow): void {
        if (event.target !== event.currentTarget) {
            return;
        }
        this.rowClick.emit(row);
    }
}

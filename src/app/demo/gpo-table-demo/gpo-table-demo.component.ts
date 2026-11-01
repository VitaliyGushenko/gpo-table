import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSwitchModule } from 'ng-zorro-antd/switch';

import { GpoTableComponent } from '../../lib/gpo-table/components/gpo-table.component';
import { GPO_TABLE_ACTIONS } from '../../lib/gpo-table/core/gpo-table-actions';
import { GPO_TABLE_CONFIG } from '../../lib/gpo-table/core/gpo-table-config';
import { GpoTableAggregatesDirective } from '../../lib/gpo-table/directives/gpo-table-aggregates.directive';
import { GpoTableCellDirective } from '../../lib/gpo-table/directives/gpo-table-cell.directive';
import { GpoTableDemoActionsService } from './gpo-table-demo-actions.service';
import { GpoTableDemoConfigService } from './gpo-table-demo.config.service';

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
        GpoTableAggregatesDirective,
        GpoTableCellDirective,
        GpoTableComponent,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [
        GpoTableDemoActionsService,
        GpoTableDemoConfigService,
        { provide: GPO_TABLE_ACTIONS, useExisting: GpoTableDemoActionsService },
        { provide: GPO_TABLE_CONFIG, useExisting: GpoTableDemoConfigService },
    ],
    template: `
        <gpo-table (rowClick)="onRowClick($event)" (rowDblClick)="onRowDblClick($event)">
            <div gpoTableHeader class="demo-toolbar">
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
                <button nz-button nzSize="small" (click)="$event.stopPropagation(); openRow(row)">
                    Открыть
                </button>
            </ng-template>

            <div gpoTableFooter class="demo-note">
                <span>{{ lastAction() }}</span>
                <span>Щёлкните строку или дважды щёлкните по ней — событие придёт на страницу.</span>
            </div>

            <ng-template
                gpoTableAggregates
                let-aggregates
                let-isLoading="isLoading"
                let-error="error">
                @if (isLoading) {
                    <span>Загрузка итогов…</span>
                } @else if (error) {
                    <span class="demo-note__error">Не удалось загрузить итоги</span>
                } @else {
                    <span>
                        Всего записей:
                        <strong>{{ (aggregates?.['count'] ?? 0) | number: '1.0-0' }}</strong>
                    </span>
                    <span>
                        Сумма:
                        <strong>{{ (aggregates?.['amount'] ?? 0) | number: '1.2-2' }}</strong>
                        руб.
                    </span>
                }
            </ng-template>
        </gpo-table>
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
    private readonly _config = inject(GpoTableDemoConfigService);
    private readonly _table = viewChild.required(GpoTableComponent);

    readonly onlyActive = this._config.onlyActive;
    readonly quickSearch = this._config.quickSearch;
    readonly fail = this._config.fail;
    readonly lastAction = this._actions.lastAction;
    readonly canEdit = this._actions.isEdit;

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

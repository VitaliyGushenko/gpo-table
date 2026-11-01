import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, TemplateRef } from '@angular/core';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';

import { GpoTableAggregates, GpoTableFooterContext } from '../../core/gpo-table.types';

/** Футер таблицы реестра: итоги, агрегаты и пагинация */
@Component({
    selector: 'gpo-table-foot',
    standalone: true,
    imports: [DecimalPipe, NgTemplateOutlet, NzPaginationModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="gpo-table__footer">
            <div class="gpo-table__summary">
                @if (aggregatesTemplate()) {
                    <ng-container
                        [ngTemplateOutlet]="aggregatesTemplate() ?? null"
                        [ngTemplateOutletContext]="{
                            $implicit: aggregates(),
                            isLoading: isAggregatesLoading(),
                            error: aggregatesError(),
                            total: total(),
                            page: page(),
                            pageSize: pageSize(),
                        }"></ng-container>
                } @else {
                    Всего записей: <strong>{{ total() | number: '1.0-0' }}</strong>
                }
            </div>

            @if (total() > 0) {
                <nz-pagination
                    [nzPageIndex]="page()"
                    [nzPageSize]="pageSize()"
                    [nzTotal]="total()"
                    [nzPageSizeOptions]="pageSizeOptionsArray()"
                    nzShowSizeChanger
                    nzShowQuickJumper
                    (nzPageIndexChange)="pageChange.emit($event)"
                    (nzPageSizeChange)="pageSizeChange.emit($event)"></nz-pagination>
            }
        </div>
    `,
    styles: [
        `
            :host {
                display: block;
            }

            .gpo-table__footer {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 8px 0;
            }

            .gpo-table__summary {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 16px;
            }
        `,
    ],
})
export class GpoTableFootComponent<TAggregates = GpoTableAggregates> {
    readonly total = input.required<number>();
    readonly page = input.required<number>();
    readonly pageSize = input.required<number>();
    readonly pageSizeOptions = input<readonly number[]>([10, 30, 50, 100, 150, 200, 250]);
    readonly aggregates = input<TAggregates | null>(null);
    readonly isAggregatesLoading = input(false);
    readonly aggregatesError = input<string | null>(null);
    readonly aggregatesTemplate = input<TemplateRef<GpoTableFooterContext<TAggregates>>>();

    readonly pageChange = output<number>();
    readonly pageSizeChange = output<number>();

    // nz-pagination принимает обычный массив, а вход таблицы — readonly
    protected readonly pageSizeOptionsArray = computed(() => [...this.pageSizeOptions()]);
}

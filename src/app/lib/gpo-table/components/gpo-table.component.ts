import {
    ChangeDetectionStrategy,
    Component,
    computed,
    contentChild,
    contentChildren,
    DestroyRef,
    effect,
    ElementRef,
    inject,
    output,
    signal,
    TemplateRef,
    untracked,
    VERSION,
    viewChild,
} from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSpinModule } from 'ng-zorro-antd/spin';

import { GpoTableAggregatesDirective } from '../directives/gpo-table-aggregates.directive';
import { GpoTableCellDirective } from '../directives/gpo-table-cell.directive';
import { GpoTableColumnWidthService } from '../services/gpo-table-column-width.service';
import { combineGridifyFilters } from '../core/gpo-table.helpers';
import {
    GPO_TABLE_CONFIG,
    GpoTableConfig,
    GPO_TABLE_DEFAULT_PAGE_SIZE_OPTIONS,
    resolveGpoTableFilter,
} from '../core/gpo-table-config';
import { GPO_TABLE_ACTIONS, isGpoTableEditAllowed, GpoTableActions } from '../core/gpo-table-actions';
import { GpoTableBodyComponent } from './body/gpo-table-body.component';
import { GpoTableFootComponent } from './foot/gpo-table-foot.component';
import { GpoTableHeadComponent } from './head/gpo-table-head.component';
import { GpoTableHeightService } from '../services/gpo-table-height.service';
import { GPO_TABLE_DEFAULT_PAGE_SIZE, GpoTableStateService } from '../services/gpo-table-state.service';
import {
    GPO_TABLE_COLUMN_MIN_WIDTH,
    GpoTableAggregates,
    GpoTableCellTemplate,
    GpoTableColumnResize,
    GpoTableColumnWidths,
    GpoTableDataSource,
    GpoTableFooterContext,
    GpoTableSort,
} from '../core/gpo-table.types';

/**
 * Angular 18 требует allowSignalWrites для записи сигналов в effect.
 * Angular 19+ разрешает запись всегда и помечает флаг как deprecated.
 */
const EFFECT_OPTIONS = Number(VERSION.major) < 19 ? { allowSignalWrites: true } : undefined;

/** Минимальная ширина авто-колонки, чтобы она не схлопывалась в ноль */
const AUTO_COLUMN_MIN_WIDTH = 120;

/** Ширина колонки действий */
const ACTIONS_COLUMN_WIDTH = 64;

/** Ширина колонки в px; для auto, rem и процентов — минимальная авто-ширина */
function getColumnWidthPx(width: string | undefined): number {
    const match = /^(\d+(?:\.\d+)?)px$/.exec(width?.trim() ?? '');
    return match ? Number(match[1]) : AUTO_COLUMN_MIN_WIDTH;
}

/** Таблица реестра: сама грузит страницы через dataSource и показывает строки */
@Component({
    selector: 'gpo-table',
    standalone: true,
    imports: [
        NzButtonModule,
        NzSpinModule,
        GpoTableBodyComponent,
        GpoTableFootComponent,
        GpoTableHeadComponent,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [GpoTableStateService, GpoTableHeightService, GpoTableColumnWidthService],
    template: `
        <!-- шапка над таблицей: кнопка добавления и контент страницы -->
        <div class="gpo-table__header">
            @if (canAdd()) {
                <button
                    nz-button
                    nzType="primary"
                    class="gpo-table__add"
                    (click)="onAdd()">
                    {{ addLabel() }}
                </button>
            }

            <div class="gpo-table__header-content">
                <ng-content select="[gpoTableHeader]" />
            </div>
        </div>

        <nz-spin [nzSpinning]="isTableLoading()">
            <div class="ant-table">
                <div class="ant-table-container">
                    <div
                        #scrollArea
                        class="ant-table-content gpo-table__scroll"
                        [style.max-height.px]="scrollMaxHeight()">
                        <table [style.min-width]="tableMinWidth()">
                            <thead
                                class="ant-table-thead"
                                gpo-table-head
                                [columns]="visibleColumns()"
                                [hasActions]="hasActions()"
                                [sort]="state.sort()"
                                (sortChange)="changeSort($event)"
                                (columnResize)="onColumnResize($event)"
                                (columnResizePreview)="onColumnResizePreview($event)"></thead>

                            <tbody
                                class="ant-table-tbody"
                                gpo-table-body
                                [columns]="visibleColumns()"
                                [hasActions]="hasActions()"
                                [rows]="state.rows()"
                                [templates]="templatesByField()"
                                [rowKey]="rowKey()"
                                [isLoading]="state.isLoading()"
                                [error]="state.error()"
                                [emptyText]="emptyText()"
                                (rowClick)="rowClick.emit($event)"
                                (rowDblClick)="rowDblClick.emit($event)"
                                (retry)="reload()"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </nz-spin>

        <!-- футер и контент под таблицей: их высота вычитается из доступной -->
        <div #belowTable class="gpo-table__below">
            @if (isShowFooter()) {
                <gpo-table-foot
                    [total]="state.total()"
                    [page]="state.page()"
                    [pageSize]="state.pageSize()"
                    [pageSizeOptions]="pageSizeOptions()"
                    [aggregates]="state.aggregates()"
                    [isAggregatesLoading]="state.isAggregatesLoading()"
                    [aggregatesError]="state.aggregatesError()"
                    [aggregatesTemplate]="aggregatesTemplate()"
                    (pageChange)="goToPage($event)"
                    (pageSizeChange)="changePageSize($event)"></gpo-table-foot>
            }

            <ng-content select="[gpoTableFooter]" />
        </div>
    `,
    styles: [
        `
            :host {
                display: block;
            }

            .gpo-table__header {
                display: flex;
                align-items: flex-start;
                gap: 12px;
            }

            .gpo-table__header-content {
                flex: 1;
                min-width: 0;
            }

            .gpo-table__add {
                flex: 0 0 auto;
                margin-bottom: 12px;
            }

            .gpo-table__scroll {
                overflow: auto;
            }

            .gpo-table__below {
                display: flow-root;
            }

            table {
                width: 100%;
                table-layout: fixed;
            }

            :host ::ng-deep .ant-table-thead > tr > th {
                position: sticky;
                top: 0;
                z-index: 1;
            }

            :host ::ng-deep .ant-table-tbody > tr:not(.gpo-table__state-row) > td:not(.gpo-table__actions-cell) {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            :host ::ng-deep .ant-table-tbody > tr.ant-table-row:focus-visible > td {
                background: #e6f4ff;
            }
        `,
    ],
})
export class GpoTableComponent<
    TRow extends object = Record<string, unknown>,
    TAggregates = GpoTableAggregates,
> {
    private readonly _config = (() => {
        const config = inject(GPO_TABLE_CONFIG, { optional: true });
        if (!config) {
            throw new Error(
                'gpo-table: предоставьте GPO_TABLE_CONFIG с колонками и источником данных',
            );
        }
        return config as GpoTableConfig<TRow, TAggregates>;
    })();
    private readonly _state = inject(GpoTableStateService) as GpoTableStateService<TRow, TAggregates>;
    private readonly _heightService = inject(GpoTableHeightService);
    private readonly _columnWidthService = inject(GpoTableColumnWidthService);
    private readonly _actions = inject(GPO_TABLE_ACTIONS, { optional: true }) as
        | GpoTableActions<TRow>
        | null;
    private readonly _scrollArea = viewChild<ElementRef<HTMLElement>>('scrollArea');
    private readonly _belowTable = viewChild<ElementRef<HTMLElement>>('belowTable');
    private readonly _columnWidths = signal<GpoTableColumnWidths>({});
    /** Ширина колонки во время перетаскивания: минимальная ширина таблицы меняется вместе с ней */
    private readonly _resizePreview = signal<GpoTableColumnResize | null>(null);
    private readonly _aggregatesDirective = contentChild(GpoTableAggregatesDirective);

    protected readonly pageSizeOptions = computed(
        () => this._config.pageSizeOptions ?? GPO_TABLE_DEFAULT_PAGE_SIZE_OPTIONS,
    );
    protected readonly rowKey = computed(() => this._config.rowKey ?? 'id');
    protected readonly emptyText = computed(() => this._config.emptyText ?? 'Данные не найдены');
    protected readonly isShowFooter = computed(() => this._config.isShowFooter ?? true);
    protected readonly aggregatesTemplate = computed(() => {
        const directive = this._aggregatesDirective();
        return directive?.templateRef as
            | TemplateRef<GpoTableFooterContext<TAggregates>>
            | undefined;
    });

    readonly rowClick = output<TRow>();
    readonly rowDblClick = output<TRow>();
    readonly pageChange = output<number>();
    readonly pageSizeChange = output<number>();
    readonly sortChange = output<GpoTableSort | null>();
    readonly aggregatesLoaded = output<TAggregates>();
    readonly totalChange = output<number>();

    protected readonly state = this._state;
    protected readonly hasActions = computed(() => {
        const actions = this._actions;
        if (!isGpoTableEditAllowed(actions)) {
            return false;
        }
        return !!actions?.onEdit || !!actions?.onRemove || !!actions?.customActions?.length;
    });
    protected readonly canAdd = computed(
        () => isGpoTableEditAllowed(this._actions) && !!this._actions?.onAdd,
    );
    protected readonly addLabel = computed(() => this._actions?.addLabel?.trim() || 'Добавить');
    private readonly _tableColumns = computed(() => {
        const widths = this._columnWidths();
        return this._config.columns.map((column) => {
            const width = widths[column.field];
            return width ? { ...column, width: `${width}px` } : column;
        });
    });
    protected readonly visibleColumns = computed(() =>
        this._tableColumns().filter((column) => column.isVisible !== false),
    );
    protected readonly isTableLoading = computed(() => this.state.isLoading() && this.state.hasRows());
    protected readonly scrollMaxHeight = computed(() => this._heightService.maxHeight());
    protected readonly tableMinWidth = computed(() => {
        const scrollWidth = this._config.scrollWidth;
        if (scrollWidth) {
            return scrollWidth;
        }

        const preview = this._resizePreview();
        const columnsWidth = this.visibleColumns().reduce(
            (sum, column) =>
                sum + (preview?.field === column.field ? preview.width : getColumnWidthPx(column.width)),
            0,
        );
        const actionsWidth = this.hasActions() ? ACTIONS_COLUMN_WIDTH : 0;
        return `${columnsWidth + actionsWidth}px`;
    });

    private readonly _cellTemplates = contentChildren(GpoTableCellDirective);
    protected readonly templatesByField = computed(() => {
        const map = new Map<string, GpoTableCellTemplate>();
        for (const directive of this._cellTemplates()) {
            map.set(directive.gpoTableCell(), directive.templateRef);
        }
        return map;
    });

    private _connectedSource: GpoTableDataSource<TRow, TAggregates> | null = null;
    private _lastFilter: string | undefined = undefined;
    private _isInitialPageSize = true;
    private _isPageSizeChanging = false;
    private _loadedStorageKey: string | undefined;
    private _isStorageKeyLoaded = false;

    constructor() {
        // Размер страницы: при инициализации только задаём значение, при изменении входа — перезагружаем
        effect(
            () => {
                const pageSize = this._config.pageSize ?? GPO_TABLE_DEFAULT_PAGE_SIZE;
                untracked(() => {
                    const pageBefore = this._state.page();
                    this._state.setPageSize(pageSize);
                    if (this._state.page() !== pageBefore) {
                        this.pageChange.emit(this._state.page());
                    }
                    if (this._isInitialPageSize) {
                        this._isInitialPageSize = false;
                        return;
                    }
                    void this._state.reload();
                });
            },
            EFFECT_OPTIONS,
        );

        // Источник, базовый фильтр и фильтр расширенного поиска
        effect(
            () => {
                const dataSource = this._config.dataSource;
                const filter = combineGridifyFilters(
                    resolveGpoTableFilter(this._config.filter),
                    resolveGpoTableFilter(this._config.searchFilter),
                );
                const pageSize = this._config.pageSize ?? GPO_TABLE_DEFAULT_PAGE_SIZE;

                untracked(() => {
                    const isSourceChanged = dataSource !== this._connectedSource;
                    const isFilterChanged = filter !== this._lastFilter;
                    if (!isSourceChanged && !isFilterChanged) {
                        return;
                    }

                    this._connectedSource = dataSource;
                    this._lastFilter = filter;
                    // Размер страницы задаём до первой загрузки: не зависим от порядка эффектов
                    this._state.setPageSize(pageSize);
                    const pageBefore = this._state.page();
                    this._state.connect(dataSource);
                    this._state.setFilter(filter);
                    // Сброс на первую страницу — тоже изменение страницы для внешних панелей
                    if (this._state.page() !== pageBefore) {
                        this.pageChange.emit(this._state.page());
                    }
                    void this._state.reloadAll();
                });
            },
            EFFECT_OPTIONS,
        );

        // Отдать наружу итоги и агрегаты для своих header/footer-панелей
        effect(() => this.totalChange.emit(this._state.total()), EFFECT_OPTIONS);
        effect(
            () => {
                const aggregates = this._state.aggregates();
                if (aggregates !== null) {
                    this.aggregatesLoaded.emit(aggregates);
                }
            },
            EFFECT_OPTIONS,
        );

        // Высота до низа окна: шапка над таблицей и блок под ней учитываются измерением
        effect(
            () => {
                const scroll = this._scrollArea()?.nativeElement;
                const below = this._belowTable()?.nativeElement;
                const bottomOffset = this._config.bottomOffset ?? 0;

                untracked(() => {
                    if (scroll && below) {
                        this._heightService.watch(scroll, below, bottomOffset);
                    }
                });
            },
            EFFECT_OPTIONS,
        );

        // Ширины колонок: читаем сохранённые один раз на ключ
        effect(
            () => {
                const storageKey = this._config.storageKey;
                untracked(() => {
                    if (this._isStorageKeyLoaded && this._loadedStorageKey === storageKey) {
                        return;
                    }
                    this._isStorageKeyLoaded = true;
                    this._loadedStorageKey = storageKey;
                    this._columnWidths.set(this._columnWidthService.load(storageKey));
                });
            },
            EFFECT_OPTIONS,
        );

        inject(DestroyRef).onDestroy(() => this._heightService.stop());
    }

    /** Перезагрузить строки и агрегаты (после сохранения, удаления и т.п.) */
    reload(): Promise<void> {
        return this._state.reloadAll();
    }

    /** Пересчитать высоту таблицы, если шапка страницы изменилась без DOM-событий */
    refreshHeight(): void {
        this._heightService.refresh();
    }

    /** Сбросить ширины колонок и удалить их из localStorage */
    resetColumnWidths(): void {
        this._columnWidths.set({});
        this._columnWidthService.clear(this._config.storageKey);
    }

    /** Перейти на страницу; для своего футера или внешней панели */
    goToPage(page: number): Promise<void> {
        // nz-pagination вместе со сменой размера присылает «хвостовую» последнюю страницу —
        // её игнорируем: смена размера всегда возвращает на первую
        if (this._isPageSizeChanging) {
            return Promise.resolve();
        }
        if (page === this._state.page()) {
            return Promise.resolve();
        }
        this._state.setPage(page);
        this.pageChange.emit(page);
        return this._state.reload();
    }

    /** Сменить размер страницы; для своего футера или внешней панели */
    changePageSize(size: number): Promise<void> {
        if (size === this._state.pageSize()) {
            return Promise.resolve();
        }
        this._isPageSizeChanging = true;
        queueMicrotask(() => {
            this._isPageSizeChanging = false;
        });
        const pageBefore = this._state.page();
        this._state.setPageSize(size);
        this.pageSizeChange.emit(size);
        if (this._state.page() !== pageBefore) {
            this.pageChange.emit(this._state.page());
        }
        return this._state.reload();
    }

    /** Сменить сортировку; для своего заголовка или внешней панели */
    changeSort(sort: GpoTableSort | null): Promise<void> {
        const current = this._state.sort();
        if (current === sort) {
            return Promise.resolve();
        }
        if (current && sort && current.field === sort.field && current.direction === sort.direction) {
            return Promise.resolve();
        }
        const pageBefore = this._state.page();
        this._state.setSort(sort);
        this.sortChange.emit(sort);
        if (this._state.page() !== pageBefore) {
            this.pageChange.emit(this._state.page());
        }
        return this._state.reload();
    }

    protected onAdd(): void {
        void this._actions?.onAdd?.();
    }

    protected onColumnResize(event: GpoTableColumnResize): void {
        const width = Math.max(GPO_TABLE_COLUMN_MIN_WIDTH, Math.round(event.width));
        this._resizePreview.set(null);
        this._columnWidths.update((widths) => ({ ...widths, [event.field]: width }));
        this._columnWidthService.save(this._config.storageKey, this._columnWidths());
    }

    protected onColumnResizePreview(event: GpoTableColumnResize | null): void {
        const current = this._resizePreview();
        if (
            current === event ||
            (current?.field === event?.field && current?.width === event?.width)
        ) {
            return;
        }
        this._resizePreview.set(event);
    }
}

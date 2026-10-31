import {
    ChangeDetectionStrategy,
    Component,
    computed,
    contentChildren,
    DestroyRef,
    effect,
    ElementRef,
    inject,
    input,
    output,
    TemplateRef,
    untracked,
    viewChild,
} from '@angular/core';
import { NzSpinModule } from 'ng-zorro-antd/spin';

import { RegistryCellDirective } from './registry-cell.directive';
import { combineGridifyFilters } from './registry-table.helpers';
import { RegistryTableBodyComponent } from './registry-table-body.component';
import { RegistryTableFootComponent } from './registry-table-foot.component';
import { RegistryTableHeadComponent } from './registry-table-head.component';
import { RegistryTableHeightService } from './registry-table-height.service';
import { REGISTRY_DEFAULT_PAGE_SIZE, RegistryTableStateService } from './registry-table-state.service';
import {
    RegistryAggregates,
    RegistryCellTemplate,
    RegistryColumn,
    RegistryDataSource,
    RegistryFooterContext,
    RegistrySort,
} from './registry-table.types';

/** Таблица реестра: сама грузит страницы через dataSource и показывает строки */
@Component({
    selector: 'app-registry-table',
    standalone: true,
    imports: [NzSpinModule, RegistryTableBodyComponent, RegistryTableFootComponent, RegistryTableHeadComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [RegistryTableStateService, RegistryTableHeightService],
    template: `
        <!-- контент над таблицей: заголовок, кнопки, поиск -->
        <ng-content select="[registryTableHeader]" />

        <nz-spin [nzSpinning]="isTableLoading()">
            <div class="ant-table">
                <div class="ant-table-container">
                    <div
                        #scrollArea
                        class="ant-table-content registry-table__scroll"
                        [style.max-height.px]="scrollMaxHeight()"
                        [style.overflow-x]="scrollWidth() ? 'auto' : 'hidden'">
                        <table [style.min-width]="scrollWidth()">
                            <thead
                                class="ant-table-thead"
                                app-registry-table-head
                                [columns]="visibleColumns()"
                                [sort]="state.sort()"
                                (sortChange)="changeSort($event)"></thead>

                            <tbody
                                class="ant-table-tbody"
                                app-registry-table-body
                                [columns]="visibleColumns()"
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
        <div #belowTable class="registry-table__below">
            @if (isShowFooter()) {
                <app-registry-table-foot
                    [total]="state.total()"
                    [page]="state.page()"
                    [pageSize]="state.pageSize()"
                    [pageSizeOptions]="pageSizeOptions()"
                    [aggregates]="state.aggregates()"
                    [isAggregatesLoading]="state.isAggregatesLoading()"
                    [aggregatesError]="state.aggregatesError()"
                    [aggregatesTemplate]="aggregatesTemplate()"
                    (pageChange)="goToPage($event)"
                    (pageSizeChange)="changePageSize($event)"></app-registry-table-foot>
            }

            <ng-content select="[registryTableFooter]" />
        </div>
    `,
    styles: [
        `
            :host {
                display: block;
            }

            .registry-table__scroll {
                overflow-y: auto;
                overflow-x: hidden;
            }

            .registry-table__below {
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

            :host ::ng-deep .ant-table-tbody > tr:not(.registry-table__state-row) > td {
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
export class RegistryTableComponent<
    TRow extends object = Record<string, unknown>,
    TAggregates = RegistryAggregates,
> {
    private readonly _state = inject(RegistryTableStateService) as RegistryTableStateService<TRow, TAggregates>;
    private readonly _heightService = inject(RegistryTableHeightService);
    private readonly _scrollArea = viewChild<ElementRef<HTMLElement>>('scrollArea');
    private readonly _belowTable = viewChild<ElementRef<HTMLElement>>('belowTable');

    readonly columns = input.required<readonly RegistryColumn[]>();
    readonly dataSource = input.required<RegistryDataSource<TRow, TAggregates>>();
    /** Постоянный Gridify-фильтр страницы */
    readonly filter = input<string>();
    /** Gridify-фильтр расширенного поиска; склеивается с filter через AND */
    readonly searchFilter = input<string>();
    readonly pageSize = input(REGISTRY_DEFAULT_PAGE_SIZE);
    readonly pageSizeOptions = input<readonly number[]>([10, 30, 50, 100, 150, 200, 250]);
    readonly rowKey = input('id');
    /** Ширина для горизонтального скролла; без неё горизонтальный скролл выключен */
    readonly scrollWidth = input<string>();
    /** Отступ снизу вне таблицы: padding страницы или внешний футер */
    readonly bottomOffset = input(0);
    readonly emptyText = input('Данные не найдены');
    readonly isShowFooter = input(true);
    readonly aggregatesTemplate = input<TemplateRef<RegistryFooterContext<TAggregates>>>();

    readonly rowClick = output<TRow>();
    readonly rowDblClick = output<TRow>();
    readonly pageChange = output<number>();
    readonly pageSizeChange = output<number>();
    readonly sortChange = output<RegistrySort | null>();
    readonly aggregatesLoaded = output<TAggregates>();
    readonly totalChange = output<number>();

    protected readonly state = this._state;
    protected readonly visibleColumns = computed(() => this.columns().filter((column) => column.isVisible !== false));
    protected readonly isTableLoading = computed(() => this.state.isLoading() && this.state.hasRows());
    protected readonly scrollMaxHeight = computed(() => this._heightService.maxHeight());

    private readonly _cellTemplates = contentChildren(RegistryCellDirective);
    protected readonly templatesByField = computed(() => {
        const map = new Map<string, RegistryCellTemplate>();
        for (const directive of this._cellTemplates()) {
            map.set(directive.appRegistryCell(), directive.templateRef);
        }
        return map;
    });

    private _connectedSource: RegistryDataSource<TRow, TAggregates> | null = null;
    private _lastFilter: string | undefined = undefined;
    private _isInitialPageSize = true;
    private _isPageSizeChanging = false;

    constructor() {
        // Размер страницы: при инициализации только задаём значение, при изменении входа — перезагружаем
        effect(
            () => {
                const pageSize = this.pageSize();
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
            { allowSignalWrites: true },
        );

        // Источник, базовый фильтр и фильтр расширенного поиска
        effect(
            () => {
                const dataSource = this.dataSource();
                const filter = combineGridifyFilters(this.filter(), this.searchFilter());
                const pageSize = this.pageSize();

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
            { allowSignalWrites: true },
        );

        // Отдать наружу итоги и агрегаты для своих header/footer-панелей
        effect(() => this.totalChange.emit(this._state.total()), { allowSignalWrites: true });
        effect(
            () => {
                const aggregates = this._state.aggregates();
                if (aggregates !== null) {
                    this.aggregatesLoaded.emit(aggregates);
                }
            },
            { allowSignalWrites: true },
        );

        // Высота до низа окна: шапка над таблицей и блок под ней учитываются измерением
        effect(
            () => {
                const scroll = this._scrollArea()?.nativeElement;
                const below = this._belowTable()?.nativeElement;
                const bottomOffset = this.bottomOffset();

                untracked(() => {
                    if (scroll && below) {
                        this._heightService.watch(scroll, below, bottomOffset);
                    }
                });
            },
            { allowSignalWrites: true },
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
    changeSort(sort: RegistrySort | null): Promise<void> {
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
}

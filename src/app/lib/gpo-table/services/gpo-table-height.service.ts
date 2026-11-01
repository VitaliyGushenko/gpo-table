import { Injectable, signal } from '@angular/core';

/** Минимальная высота области таблицы: на низком экране страница лучше проскроллится */
export const MIN_GPO_TABLE_HEIGHT = 200;

/** Доступная высота таблицы: окно минус верх таблицы, блок под ней и отступ страницы */
export function calculateGpoTableMaxHeight(
    viewportHeight: number,
    tableTop: number,
    belowHeight: number,
    bottomOffset = 0,
): number {
    const available = viewportHeight - Math.max(0, tableTop) - belowHeight - bottomOffset;
    return Math.max(MIN_GPO_TABLE_HEIGHT, Math.floor(available));
}

/** Считает максимальную высоту таблицы до низа окна; при малом числе строк не растягивает её */
@Injectable()
export class GpoTableHeightService {
    readonly maxHeight = signal<number | null>(null);

    private _scrollElement: HTMLElement | null = null;
    private _belowElement: HTMLElement | null = null;
    private _bottomOffset = 0;
    private _resizeObserver: ResizeObserver | null = null;
    private _mutationObserver: MutationObserver | null = null;
    private _frame = 0;

    private readonly _onWindowResize = (): void => this._scheduleUpdate();

    /** Начать следить за положением таблицы и высотой блока под ней */
    watch(scrollElement: HTMLElement, belowElement: HTMLElement, bottomOffset = 0): void {
        if (typeof window === 'undefined') {
            return;
        }

        if (
            this._scrollElement === scrollElement &&
            this._belowElement === belowElement &&
            this._bottomOffset === bottomOffset
        ) {
            this._update();
            return;
        }

        this.stop();
        this._scrollElement = scrollElement;
        this._belowElement = belowElement;
        this._bottomOffset = bottomOffset;

        window.addEventListener('resize', this._onWindowResize);
        window.visualViewport?.addEventListener('resize', this._onWindowResize);

        if (typeof ResizeObserver !== 'undefined') {
            this._resizeObserver = new ResizeObserver(() => this._scheduleUpdate());
            // body — шапка страницы и переносы controls, элементы таблицы — её собственные изменения
            this._resizeObserver.observe(document.body);
            this._resizeObserver.observe(scrollElement);
            this._resizeObserver.observe(belowElement);
        }

        if (typeof MutationObserver !== 'undefined') {
            // Появление/исчезновение контролов над таблицей меняет её верх без изменения размера body
            this._mutationObserver = new MutationObserver(() => this._scheduleUpdate());
            this._mutationObserver.observe(document.body, { childList: true, subtree: true });
        }

        this._update();
    }

    /** Пересчитать высоту вручную (например, после изменения своего блока над таблицей) */
    refresh(): void {
        this._scheduleUpdate();
    }

    /** Перестать следить и сбросить вычисленную высоту */
    stop(): void {
        if (typeof window !== 'undefined') {
            window.removeEventListener('resize', this._onWindowResize);
            window.visualViewport?.removeEventListener('resize', this._onWindowResize);
        }

        this._resizeObserver?.disconnect();
        this._resizeObserver = null;
        this._mutationObserver?.disconnect();
        this._mutationObserver = null;
        this._scrollElement = null;
        this._belowElement = null;

        if (this._frame) {
            cancelAnimationFrame(this._frame);
            this._frame = 0;
        }

        this.maxHeight.set(null);
    }

    /** Пересчитать не чаще одного кадра: ResizeObserver может срабатывать пачкой */
    private _scheduleUpdate(): void {
        if (this._frame) {
            return;
        }
        this._frame = requestAnimationFrame(() => {
            this._frame = 0;
            this._update();
        });
    }

    private _update(): void {
        const scroll = this._scrollElement;
        if (!scroll) {
            return;
        }

        const viewportHeight = document.documentElement.clientHeight;
        const top = scroll.getBoundingClientRect().top;
        const belowHeight = this._belowElement?.offsetHeight ?? 0;

        this.maxHeight.set(
            calculateGpoTableMaxHeight(viewportHeight, top, belowHeight, this._bottomOffset),
        );
    }
}

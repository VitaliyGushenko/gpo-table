import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    EventEmitter,
    Input,
    OnDestroy,
    OnInit,
    Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTimePickerModule } from 'ng-zorro-antd/time-picker';
import { NzTreeSelectModule } from 'ng-zorro-antd/tree-select';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AutoInjectorService } from 'src/app/services/auto-injector.service';

import { SearchItem, SearchItemType, SearchItems } from './search-item';

/**
 * Событие кнопки «Поиск» drawer'а расширенного поиска.
 *
 * filter — плоский объект с суффиксами условий (прямой вход applySearchForm /
 * для gql-страниц — готовый where); modes — значения before-контролов
 * режимов (например productName → 'FULL' | 'PARTIAL'), в фильтр не попадают.
 */
export interface SearchEvent<TFilter> {
    filter: TFilter;
    modes: Record<string, unknown>;
}

/** Событие изменения watched-контрола формы */
export interface SearchControlChange {
    key: string;
    value: unknown;
}

/**
 * Расширенный поиск REST-таблиц: сам рисует drawer (форма + футер
 * «Закрыть / Очистить / Поиск») и владеет всей синхронизацией значений.
 *
 * Дескрипторы ([items]) — чистая конфигурация без состояния; значения живут
 * только в Reactive Form. Наружу компонент отдаёт:
 *   (search) — плоский фильтр с суффиксами + режимы (before-контролы);
 *   (clear)  — очистка фильтра;
 *   (controlChange) — изменения watched-полей (кросс-правила страницы).
 *
 * Запись значений извне (deep-links, дерево, сторонние компоненты):
 *   [filter]/[modes] — исходное состояние для open(),
 *   patchFilter() — то же отображение суффиксов в контролы в рантайме,
 *   setDisabled() — программная блокировка поля.
 */
@Component({
    selector: 'app-advanced-search-rest',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        NzFormModule,
        NzGridModule,
        NzDrawerModule,
        NzInputModule,
        NzInputNumberModule,
        NzButtonModule,
        NzDatePickerModule,
        NzSelectModule,
        NzSwitchModule,
        NzTimePickerModule,
        NzIconModule,
        NzTreeSelectModule,
    ],
    templateUrl: './rest-advanced-search.component.html',
    styleUrls: ['./rest-advanced-search.component.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RestAdvancedSearchComponent implements OnInit, OnDestroy {
    /**
     * Описание полей расширенного поиска (чистая конфигурация)
     */
    @Input() items: SearchItems<any>;

    /**
     * Исходный фильтр для синхронизации формы при открытии drawer'а
     */
    @Input() filter: object;

    /**
     * Исходные значения режимов (before-контролов): ключ поля → значение режима
     */
    @Input() modes: Record<string, unknown>;

    /**
     * Заголовок drawer'а
     */
    @Input() title = 'Расширенный поиск';

    /**
     * Кнопка «Поиск»: фильтр + режимы
     */
    @Output() search = new EventEmitter<SearchEvent<any>>();

    /**
     * Кнопка «Очистить»
     */
    @Output() clear = new EventEmitter<void>();

    /**
     * Изменение watched-поля (дескриптор с watchChange())
     */
    @Output() controlChange = new EventEmitter<SearchControlChange>();

    /**
     * Drawer открыт
     */
    visible = false;

    /**
     * Форма расширенного поиска
     */
    form: UntypedFormGroup;

    /**
     * Данные справочников по ключам полей (читаются из провайдеров);
     * хранятся в компоненте, чтобы дескрипторы оставались без состояния
     */
    dictionaries: Record<string, any[]> = {};

    /**
     * Типы полей (для шаблона)
     */
    readonly itemType = SearchItemType;

    /**
     * Словарь с кодами (записи toCodeDictionary): рисуется через nz-option
     * с выделенным жирным кодом, остальные — через nzOptions
     */
    protected isCodeDictionary(key: string): boolean {
        return (this.dictionaries[key] ?? []).some((option) => option?.code !== undefined);
    }

    private readonly destroy$ = new Subject<void>();
    private readonly formRebuilt$ = new Subject<void>();

    constructor(
        private fb: UntypedFormBuilder,
        private injectorService: AutoInjectorService,
        private cdr: ChangeDetectorRef,
    ) {}

    ngOnInit(): void {
        this.buildForm();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.formRebuilt$.complete();
    }

    ngOnChanges(changes: { items?: unknown }): void {
        // пересборка формы при смене конфигурации (например переключение отчётного режима)
        if (changes.items && this.items && this.form) {
            this.buildForm();
        }
    }

    /**
     * Форма невалидна (нарушен порядок границ хотя бы в одном диапазоне)
     */
    get invalid(): boolean {
        return this.form?.invalid ?? false;
    }

    // ===========================================================================
    // Открытие / закрытие
    // ===========================================================================

    /**
     * Открыть drawer: свежие справочники + синхронизация формы
     * с текущим фильтром ([filter]/[modes])
     */
    open(): void {
        this.refreshDictionaries();
        if (this.form) {
            this.form.reset(this.buildDefaults(), { emitEvent: false });
            this.patchFilter(this.filter, this.modes);
        }
        this.visible = true;
        // OnPush: метод зовут извне (кнопка страницы) — сами помечаем вид к проверке
        this.cdr.markForCheck();
    }

    close(): void {
        this.visible = false;
        this.cdr.markForCheck();
    }

    /**
     * Перечитать справочники из провайдеров (вызывается при каждом открытии)
     */
    refreshDictionaries(): void {
        for (const [key, item] of Object.entries(this.items ?? {})) {
            if (item.dictionaryProvider) {
                this.dictionaries[key] = item.dictionaryProvider() ?? [];
            }
        }
    }

    // ===========================================================================
    // Программная работа с формой (deep-links, дерево, сторонние компоненты)
    // ===========================================================================

    /**
     * Записать значения в форму: обратное отображение плоского фильтра
     * в контролы. Владелец ключа ищется по filterKeys дескрипторов, запись
     * делает сам дескриптор (patchControl: диапазоны → from/to, числовые
     * условия → {type, value}); режимы (__before) и суффиксные ключи без
     * владельца (легаси сохранённых фильтров) пишутся напрямую.
     * Неизвестные ключи игнорируются.
     */
    patchFilter(filter?: object, modes?: Record<string, unknown>): void {
        if (!this.form) {
            return;
        }
        for (const [key, value] of Object.entries(modes ?? {})) {
            this.form.get(`${key}__before`)?.setValue(value);
        }
        for (const [filterKey, value] of Object.entries(filter ?? {})) {
            if (value === null || value === undefined) {
                continue;
            }
            this.patchFilterEntry(filterKey, value);
        }
        this.cdr.markForCheck();
    }

    /**
     * Запись одного ключа фильтра в контрол(ы) формы
     */
    private patchFilterEntry(filterKey: string, value: unknown): void {
        // легаси: режимы (before-контролы) сохранялись и внутри фильтра
        if (filterKey.endsWith('__before')) {
            this.form.get(filterKey)?.setValue(value);
            return;
        }
        for (const [key, item] of Object.entries(this.items ?? {})) {
            if (item?.filterKeys(key)?.includes(filterKey)) {
                const group = this.form.get(key);
                if (group) {
                    item.patchControl(key, filterKey, value, group);
                }
                return;
            }
        }
        // суффиксный ключ без владельца в items — пишем в базовый контрол
        const base = this.splitConditionKey(filterKey);
        if (base && this.form.get(base)) {
            this.form.get(base)?.setValue(value);
            return;
        }
        this.form.get(filterKey)?.setValue(value);
    }

    /**
     * Блокировка / разблокировка поля (дерево, кросс-правила)
     */
    setDisabled(key: string, disabled: boolean): void {
        const control = this.form?.get(key);
        if (!control) {
            return;
        }
        disabled ? control.disable({ emitEvent: false }) : control.enable({ emitEvent: false });
        this.cdr.markForCheck();
    }

    getControl(key: string) {
        return this.form?.get(key);
    }

    // ===========================================================================
    // Чтение формы
    // ===========================================================================

    /**
     * Плоский фильтр (ключи с суффиксами условий); пусто → undefined.
     * Скрытые поля (visible = false) управляются снаружи — из формы не читаются.
     */
    getFilter(): any | undefined {
        if (!this.form) {
            return undefined;
        }
        const raw = this.form.getRawValue();
        const filter: Record<string, unknown> = {};
        for (const [key, item] of Object.entries(this.items ?? {})) {
            if (!item || item.visible === false) {
                continue;
            }
            Object.assign(filter, item.toFilter(key, raw[key]));
        }
        return Object.keys(filter).length ? filter : undefined;
    }

    /**
     * Значения режимов (before-контролов): ключ поля → значение режима
     */
    getModes(): Record<string, unknown> {
        if (!this.form) {
            return {};
        }
        const raw = this.form.getRawValue();
        const modes: Record<string, unknown> = {};
        for (const [key, item] of Object.entries(this.items ?? {})) {
            if (item.beforeList?.length) {
                const value = raw[`${key}__before`];
                if (value !== null && value !== undefined) {
                    modes[key] = value;
                }
            }
        }
        return modes;
    }

    // ===========================================================================
    // Кнопки футера
    // ===========================================================================

    emitSearch(): void {
        this.search.emit({ filter: this.getFilter() ?? {}, modes: this.getModes() });
        this.visible = false;
    }

    emitClear(): void {
        this.form?.reset(this.buildDefaults(), { emitEvent: false });
        this.clear.emit();
        this.visible = false;
    }

    // ===========================================================================
    // Встраиваемый компонент (модалка выбора)
    // ===========================================================================

    /**
     * Открыть модалку выбора: значение возвращается через выход компонента
     * и пишется в контрол формы
     */
    openEmbedded(key: string, item: SearchItem): void {
        const componentItem = item as SearchItem & {
            component: any;
            input?: any;
            outputName?: string;
            isSetting?: boolean;
        };
        const control = this.form.get(key);
        const output = componentItem.outputName ?? 'update';
        const component = this.injectorService.create<any>(
            componentItem.component,
            componentItem.isSetting ? { settings: componentItem.input } : componentItem.input ?? null,
            {
                [output]: (data: any) =>
                    control?.setValue(componentItem.isSetting ? data.selected.id : data[0] ?? null),
            },
        );
        if (componentItem.isSetting) {
            componentItem.input.show();
        } else {
            component.show(control?.value ? [control.value] : []);
        }
    }

    /**
     * Компаратор для keyvalue: 0 сохраняет порядок объявления полей
     */
    sortItems(): number {
        return 0;
    }
    // ===========================================================================

    private buildForm(): void {
        const controlsConfig: Record<string, unknown> = {};
        for (const [key, item] of Object.entries(this.items ?? {})) {
            if (!item) {
                continue;
            }
            // структура контрола — знание дескриптора (группы условий/диапазонов и т.п.)
            controlsConfig[key] = item.createControl(this.fb, item.initialDisabled);
            if (item.beforeList?.length) {
                controlsConfig[`${key}__before`] = [{ value: item.beforeList[0].value, disabled: false }];
            }
            this.dictionaries[key] = item.dictionaryProvider?.() ?? item.dictionary ?? [];
        }
        this.form = this.fb.group(controlsConfig);

        // подписки watched-полей: пересоздаются при каждой сборке формы
        this.formRebuilt$.next();
        for (const [key, item] of Object.entries(this.items ?? {})) {
            if (!item?.watch) {
                continue;
            }
            this.form
                .get(key)
                ?.valueChanges.pipe(takeUntil(this.destroy$), takeUntil(this.formRebuilt$))
                .subscribe((value) => this.controlChange.emit({ key, value }));
        }
    }

    /**
     * Значения по умолчанию для сброса формы: условия numberCond (первое — «Равно»),
     * границы диапазонов, режимы beforeList (первое значение списка) — знает
     * дескриптор (defaultValue); остальное — пусто.
     */
    private buildDefaults(): Record<string, unknown> {
        const defaults: Record<string, unknown> = {};
        for (const [key, item] of Object.entries(this.items ?? {})) {
            if (!item) {
                continue;
            }
            defaults[key] = item.defaultValue();
            if (item.beforeList?.length) {
                defaults[`${key}__before`] = item.beforeList[0].value;
            }
        }
        return defaults;
    }

    /**
     * Разбор суффиксного ключа фильтра в базовый контрол
     * (_in/_contains/_not/_eq/_gt/_lt/_starts_with/_not_in)
     */
    private splitConditionKey(key: string): string | undefined {
        for (const suffix of ['_contains', '_starts_with', '_not_in', '_in', '_not', '_eq', '_gt', '_lt']) {
            if (key.endsWith(suffix) && this.form.get(key.slice(0, -suffix.length))) {
                return key.slice(0, -suffix.length);
            }
        }
        return undefined;
    }
}

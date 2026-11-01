# Таблица реестра на сигналах: текущий `gpo-lib` и проект `gpo-table`

> Статус: проект. Код новой таблицы ещё не написан.
>
> Документ отвечает на два вопроса:
> 1. Как сейчас устроена библиотека `src/app/lib` (`gpo-lib`) и почему её таблицу тяжело развивать.
> 2. Какой должна быть новая таблица `gpo-table` в `src/app/lib/gpo-table`, чтобы внедрение
>    на странице занимало несколько строк, а данные грузились одним REST-запросом Gridify.
>
> Смежные документы: [rest-table-buy-architecture.md](./rest-table-buy-architecture.md) — текущая связка
> «таблица + REST + поиск» на buy; [tables-migration-plan.md](./tables-migration-plan.md) — миграция
> остальных страниц; `src/app/components/advanced-search-rest/README.md` — расширенный поиск.
> Новая таблица заменяет **только слой визуализации**. Поиск, формы, права и экспорт остаются
> за страницей и существующим стеком.

---

## 1. Коротко: что меняется

| | Сейчас (`lib-gpo-table`) | Новая (`gpo-table`) |
|---|---|---|
| Откуда данные | приходят в `@Input() dataTable` | таблица сама запрашивает данные через переданный `dataSource` (swagger + Gridify) |
| Состояние | мутируемые поля класса + RxJS + `ChangeDetectorRef` | только `signal`/`computed`, без подписок |
| Разметка | один компонент на 653 строки TS + 982 строки HTML | контейнер + `head` / `body` / `row` / `foot` |
| Колонки | класс `ColumnFiltered` с 20 позиционными параметрами и 18 типами | объект с 4 типами: `text`, `number`, `date`, `template` |
| Пагинация и сортировка | снаружи: страница ловит события и сама грузит | внутри: таблица меняет состояние и грузит |
| Фильтры | встроены в шапку каждой таблицы (воронки, условия) | расширенный поиск — опциональный drawer, поля строятся из колонок; воронок в шапке нет |
| CRUD, карточки, настройки, подсветка, дерево | всё в одной библиотеке | нет; шаблонная колонка и отдельные компоненты страницы |
| Внедрение | 30–60 строк шаблона + модель таблицы + обработчики | `dataSource` из swagger-методов, `columns`, при необходимости `filter` |

---

## 2. Текущая структура `gpo-lib`

### 2.1. Где лежит и как подключается

- Каталог: `src/client/ias/src/app/lib/`.
- Alias: `gpo-lib` → `src/app/lib/public-api.ts` (`tsconfig.json`, `compilerOptions.paths`).
- Публичный API (`public-api.ts`) экспортирует не только таблицу, но и сервис, дерево, формы,
  уведомления, токены, пайпы и утилиту подсветки:

```ts
export * from './gpo-lib.service';
export * from './gpo-lib.component';
export * from './gpo-lib.module';
export { NumberPipe } from './numberPipe';
export * from './gpo-lib-table-tree/...';
export { ActionsRow } from './modules/edit-form/edit-form.component';
export * from './SortDirection';
export * from './models/Column';
export * from './modules/settings-form/...';
export * from './models/Notification';
export * from './modules/notification/...';
export * from './tokens/lib-token';
export { Highlight } from './highlight';
```

Библиотека старая: компоненты `standalone: false`, собираются через `GpoLibModule`.

### 2.2. Состав библиотеки

| Файл / модуль | Роль | Нужен новой таблице |
|---|---|---|
| `gpo-lib.component.*` | Основная таблица `lib-gpo-table` | заменяется |
| `gpo-lib.service.ts` | Глобальный сервис: `localStorage` колонок, событие resize, расчёт высоты по DOM | нет |
| `models/Column.ts` | `ColumnFiltered`, `ETypeColumn`, `ETypeColumnFilter`, `Condition`, `Select` | заменяется |
| `gpo-lib-template.directive.ts` | `ng-template[gpoLibTemplate]` — шаблоны ячеек по ключу | заменяется директивой `gpoTableCell` |
| `gpo-lib-table-tree/*` | Отдельное дерево `lib-gpo-lib-table-tree` (`TreeTable`, `ColumnHeader`) | остаётся в `gpo-lib` до отдельного проекта |
| `modules/edit-form/*` | Модалка создания/редактирования, удаления и восстановления записи по URL | нет; заменяется шаблонной колонкой и компонентами страницы |
| `modules/settings-form/*` | Модалка видимости/порядка колонок, сброс к значениям из кода | нет (возможное расширение позже) |
| `cell-card/*` | Карточка строки для режима «карточки» | нет |
| `switcher-view/*` | Переключатель «таблица / карточки» | нет |
| `highlight.ts`, `highlight.worker.ts` | Подсветка латинских символов, похожих на кириллицу | нет |
| `sort-list.pipe.ts` | Сортировка карточек | нет |
| `numberPipe.ts` | Число с разделителями разрядов | заменяется `DecimalPipe` |
| `modules/notification/*` | Уведомления | остаётся в `gpo-lib` |
| `tokens/lib-token.ts` | Токены `NOTIFICATION_ICONS`, `SORT_LIST_TABLE`, `INDEXED_TABLES` | нет |
| `typed-gridify/*` | Транспорт Gridify, репозиторий, таблица реестра | переиспользуется только `TypedGridifyBuilder` для сборки `filter` на странице |

### 2.3. Что делает `lib-gpo-table`

Компонент одновременно отвечает за:

- рендер шапки, строк и ячеек по типу колонки;
- пагинацию и сортировку (события наружу);
- фильтры по колонкам (строки, числа, даты, списки, спец-колонка);
- изменение ширины колонок drag-and-drop;
- сохранение видимости/порядка/ширины/фильтров/сортировки в `localStorage`;
- расчёт высоты таблицы по DOM-селекторам;
- подсветку латинских символов (web-worker);
- режим карточек (`switcher`);
- CRUD через встроенный `app-edit-form`;
- кастомные кнопки, title/legend/footer-шаблоны, колонку действий;
- виртуальный скролл (вторая почти полная копия разметки).

### 2.4. Контракт `lib-gpo-table`

Входы (около 50; сгруппированы по смыслу):

| Группа | Входы |
|---|---|
| Данные | `dataTable`, `loading`, `columns`, `totalCount`, `pageIndex`, `pageSize` |
| Отображение | `useVirtualScroll`, `userFontSize`, `scrollX`, `size`, `bordered`, `ellipsis`, `widthAdd`, `heightAdd` |
| Размеры и окружение | `selectorStart`, `selectorEnd`, `parentNode`, `tablelayout`* |
| Пагинация | `showPagination`, `showSizeChanger`*, `frontPagination`*, `paginationPosition`* |
| Колонки | `unicumField`, `customFirstThCol`, `customFirstThColTemplate`, `customFirstThColWidth`, `customFirstTdCol`, `customThBtnName`, `customThBtnWidth`, `isCustomThBtnNameRight`, `customTdBtn`, `typeColumn`, `specialColumn`, `statusTd`, `formatDate` |
| Фильтры | `conditions`, `conditionsNumber` |
| Редактирование | `editAccess`, `actionsForm`, `customButtons`, `isShowActions`, `isShowSettings`, `mainActionsTemplate`, `otherActionsTemplate` |
| Оформление | `title`, `legend`, `footerTemplate`, `addingExtendedClass`, `addingExtendedRowClass`, `titleTableName`, `selectDisplayMode` |

\* `tablelayout`, `showSizeChanger`, `frontPagination`, `paginationPosition` объявлены, но в шаблоне
не используются — мёртвые входы.

Выходы:

| Выход | Когда |
|---|---|
| `changed` | завершено создание/редактирование/удаление/кастомная кнопка |
| `filtered` | применён или сброшен фильтр колонки |
| `clickedTd` | клик по строке |
| `clickActiveCell` | клик по «активной» ячейке |
| `dblclickRow` | двойной клик по строке |
| `pageIndexChange`, `pageSizeChange` | пагинация |
| `sortColumnChange` | сортировка (`{ columnName, directionType }`) |

### 2.5. Модель колонки

`ColumnFiltered` — класс с 20 параметрами конструктора:

```ts
new ColumnFiltered(
    name, columnKey, visible = false, width = null, filter?, sort?,
    type = ETypeColumn.string, typeFilter = ETypeColumnFilter.text,
    sortOrder = null, searchValue = null, active = false, select = false,
    selection?, selectable = true, inwhere = true, condition?, order?,
    orientation?, trackedField?, enumKeyValueObject?,
)
```

Проблемы модели:

- `visible` по умолчанию `false` — колонку легко «потерять»;
- позиционные аргументы: `new ColumnFiltered('Код', 'code', true, '100px', false, true)` читается только
  с подсказкой IDE;
- в одном объекте смешаны представление (`type`, `width`, `orientation`), состояние фильтра
  (`searchValue`, `condition`, `active`), состояние сортировки (`sortOrder`) и настройки хранения
  (`visible`, `order`);
- 18 типов ячеек и 6 типов фильтров, большинство из которых — частные случаи `template`.

### 2.6. Как рендерится ячейка

В шаблоне — большой `[ngSwitch]="column.type"`:

```html
<span *ngSwitchCase="ETypeColumn.number">{{ data[column.columnKey] }}</span>
<span *ngSwitchCase="ETypeColumn.enum">{{ column.enumKeyValueObject[data[column.columnKey]] }}</span>
<span *ngSwitchCase="ETypeColumn.boolean"><label nz-checkbox nzDisabled ...></label></span>
<span *ngSwitchCase="ETypeColumn.string" [innerHTML]="highlighted"></span>
<span *ngSwitchCase="ETypeColumn.date">{{ data[column.columnKey] | date: ... }}</span>
<span *ngSwitchCase="ETypeColumn.status"><ng-container *ngTemplateOutlet="statusTd"></ng-container></span>
<span *ngSwitchCase="ETypeColumn.template"><ng-template [ngTemplateOutlet]="..."></ng-template></span>
```

Тот же блок продублирован для таблицы с виртуальным скроллом (HTML-файл содержит две почти
одинаковые копии шапки, строк и фильтров — примерно строки 9–353 и 427–787).

### 2.7. Поток данных сейчас

`lib-gpo-table` не знает о транспорте. Страница создаёт модель таблицы (обычно наследник
`BaseTable`), грузит данные и передаёт их входами:

```
Страница / BaseTable
  ├─ filter, order, page, count        ──►  [dataTable], [totalCount], [pageIndex], [pageSize]
  └─ getData(table) / updateTable()    ◄──  (pageIndexChange), (pageSizeChange), (sortColumnChange)
```

То есть на каждой странице нужно:

1. создать модель таблицы и колонки;
2. реализовать `getData`, `getTotalCount`, обработчики пагинации/сортировки;
3. связать модель с входами/выходами шаблона;
4. отдельно настроить `localStorage`, высоту, фильтры и действия.

### 2.8. Сайд-эффекты и окружение

- `GpoLibService` — `providedIn: 'root'`, подписан на `window.resize`, хранит колонки в `localStorage`.
- Ключи `localStorage`: `titleTableName`, `${titleTableName}Highlight`, `${titleTableName}_switcher`.
- Высота считается по DOM: `document.querySelector(selectorStart/selectorEnd)`, `getBoundingClientRect`,
  `getComputedStyle`, затем `setTimeout(..., 350)` после события resize.
- Сортировка проходит через `BehaviorSubject` + `throttleTime(100)`.
- Изменения состояния нередко требуют `ChangeDetectorRef.detectChanges()`.
- Часть полей не используется вовсе: `nowDate`, `datesDisabled`, `markDisabled`, `rowClicked`,
  `parentHeight`, `showSettings`, `loadDatePicker`.

### 2.9. Масштаб использования

- `lib-gpo-table` используется в **47 HTML-шаблонах** (buy, asot, mid, remnant, nsi, administration).
- Импорты из `gpo-lib` есть в **278 TS-файлах**: модели таблиц, экспорт, печать, cell-card,
  настройки колонок, деревья.
- Поэтому `gpo-lib` нельзя удалить или переписать целиком: новая таблица делается рядом,
  миграция — по одной странице.

### 2.10. Вывод

`lib-gpo-table` — не «таблица», а небольшой фреймворк для реестров: визуализация, фильтры,
настройки, CRUD, карточки и подсветка в одном компоненте. Из-за этого:

- любое изменение рискует задеть 47 страниц;
- шаблон невозможно прочитать целиком и трудно тестировать;
- данные и состояние размазаны между страницей и таблицей;
- новые требования (REST Gridify, сигналы, простой контракт) некуда аккуратно встроить.

Новая таблица решает узкую задачу: **показать страницу реестра из Gridify REST, дать пагинацию
и сортировку, остальное — через шаблонные ячейки и внешние компоненты.**

---

## 3. Проект новой таблицы `gpo-table`

### 3.1. Принципы

1. **Только сигналы.** Состояние — `signal`, производные — `computed`, входы/выходы — `input()`/`output()`.
   Никаких `BehaviorSubject`, ручных `subscribe` и `detectChanges`.
2. **Standalone + OnPush.** Новых `NgModule` нет.
3. **Таблица сама грузит данные.** Один GET на страницу; агрегаты — опционально вторым запросом.
4. **Разделение на компоненты.** Контейнер знает про REST и состояние; `head`, `body`, `row`, `foot`
   — только отображение.
5. **Колонки — данные, а не поведение.** Объект `GpoTableColumn`; сложное поведение — шаблонная
   колонка.
6. **Ничего лишнего в v1.** Ни карточек, ни настроек колонок, ни CRUD, ни фильтров в шапке,
   ни виртуального скролла, ни подсветки.
7. **Высота — до низа окна.** Область таблицы получает `max-height` от сервиса: окно минус
   верх таблицы, футер и слот под ней. При малом числе строк высота остаётся по содержимому.
8. **Ошибки и пустота — штатные состояния.** Они проектируются сразу, а не добавляются позже.

### 3.2. Границы v1

**Входит:**

- Gridify REST: `page`, `pageSize`, `orderBy`, `filter` + дополнительные query-параметры;
- опциональные агрегаты (`getAggregates` в `dataSource`);
- пагинация (номер, размер, быстрый переход);
- сортировка по одной колонке (по возрастанию / убыванию / без сортировки);
- колонки `text`, `number`, `date`, `template`;
- шаблоны ячеек через `<ng-template gpoTableCell="field">`;
- контент над/под таблицей через `gpoTableHeader` / `gpoTableFooter`;
- опциональный расширенный поиск: кнопка по флагу, поля строятся из колонок,
  исключения/справочники — в `column.search`;
- состояния: загрузка, пусто, ошибка с повтором;
- сброс страницы при смене фильтра, размера страницы и сортировки;
- защита от гонок: поздний ответ не затирает свежие данные.

**Не входит в v1 (осознанно):**

- воронки/фильтры в шапке колонок — нет; расширенный поиск живёт в drawer'е;
- CRUD-модалки и их формы — компоненты страницы; встроенная колонка действий — по сервису токена;
- карточки, переключатель режимов, дерево;
- настройки видимости/порядка колонок; ширины колонок сохраняются;
- виртуальный скролл;
- выделение строк, чекбоксы, раскрытие строк;
- подсветка латинских символов;
- встроенный экспорт/печать;
- вторая строка заголовка (группированные шапки).

Всё перечисленное либо делает страница снаружи, либо добавляется отдельным шагом после пилота
на 2–3 реальных страницах.

### 3.3. Схема компонентов

```
<gpo-table>                        контейнер: входы, эффект загрузки, состояние
  ├─ ng-content[gpoTableHeader]         панель над таблицей (кнопки, поиск)
  ├─ nz-table (nzTemplateMode)               стили и загрузочный оверлей ng-zorro
  │   ├─ <thead gpo-table-head>     шапка: заголовки, сортировка
  │   └─ <tbody gpo-table-body>     тело: состояния + @for строк
  │        └─ <tr gpo-table-row>    строка: ячейки по типу колонки
  ├─ <gpo-table-foot>               футер: «Всего записей», агрегаты, пагинация
  └─ ng-content[gpoTableFooter]         панель под таблицей (примечания, свой футер)
```

Почему `thead`/`tbody`/`tr` — это компоненты-атрибуты, а не обёртки-`div`:

- разметка остаётся семантической (`table > thead > tr > th`, `table > tbody > tr > td`);
- `head`, `body` и `row` находятся в одном `<table>`, поэтому ширины колонок согласованы
  без ручной синхронизации;
- таблица собрана на нативной `<table>` с классами `ant-table`; причины — в уточнении ниже.

**Уточнение по итогам реализации.** Компоненты на `thead`/`tbody` внутри `nz-table` сделать
не получилось: ng-zorro объявляет на этих же узлах свои компоненты (`NzTheadComponent`,
`NzTbodyComponent`), Angular падает с `NG0300: Multiple components match node`. Поэтому таблица
собрана на нативной `<table>` с классами `ant-table`: шапка на `thead` и тело на `tbody` — наши
компоненты, загрузочный оверлей — `nz-spin`, пагинация и пустое состояние — модули ng-zorro.
Это запасной вариант из §5.4; стили ant применяются, sticky-шапка включается в CSS.

### 3.4. Файлы

```
src/app/lib/gpo-table/
├─ index.ts                          // публичный API ядра
├─ core/
│  ├─ gpo-table.types.ts             // GpoTableColumn, GpoTableQuery, GpoTableDataSource
│  ├─ gpo-table.helpers.ts           // readGpoTableValue, getErrorMessage, combineGridifyFilters
│  └─ gpo-table-actions.ts           // GPO_TABLE_ACTIONS — действия строки из сервиса
├─ components/
│  ├─ gpo-table.component.ts         // контейнер gpo-table
│  ├─ head/gpo-table-head.component.ts // thead[gpo-table-head]
│  ├─ body/gpo-table-body.component.ts // tbody[gpo-table-body]
│  ├─ row/gpo-table-row.component.ts  // tr[gpo-table-row]
│  ├─ row/gpo-table-row-actions.component.ts // меню «⋯»
│  └─ foot/gpo-table-foot.component.ts // gpo-table-foot
├─ directives/
│  ├─ gpo-table-cell.directive.ts    // ng-template[gpoTableCell]
│  └─ gpo-table-column-resize.directive.ts // ручка изменения ширины
├─ services/
│  ├─ gpo-table-state.service.ts     // GpoTableStateService — сигналы и загрузка
│  ├─ gpo-table-height.service.ts    // GpoTableHeightService — высота до низа окна
│  └─ gpo-table-column-width.service.ts // сохранение ширин в localStorage
├─ search/
│  └─ gpo-table-search-fields.ts     // buildGpoTableSearchFields
├─ adapters/                         // источники данных; ядро их не импортирует
│  ├─ index.ts
│  ├─ swagger-gridify-data-source.ts // swaggerGridifyDataSource — рабочий проект
│  └─ static-gridify-data-source.ts  // staticGridifyDataSource — дом/демо без бэкенда
├─ README.md
└─ CHANGELOG.md
```

Демо — внешний потребитель, поэтому лежит вне переносимой папки:
`src/app/demo/gpo-table-demo/` (`gpo-table-demo.component.ts` и сервис действий).

Спеки лежат рядом со своими файлами (`*.spec.ts`), в публичный API не входят.

Проектный слой — **вне** переносимой папки, чтобы дома не компилировались импорты
недоступного стека:

```
src/app/lib/gpo-table-integrations/
└─ advanced-search/
   ├─ index.ts
   ├─ gpo-table-search.component.ts   // кнопка + drawer app-advanced-search-rest
   └─ gpo-table-search-items.ts        // GpoTableSearchField → SearchItem
```

`gpo-table-integrations` импортирует `gpo-table` и стек проекта
(`advanced-search-rest`, `typed-gridify`); при копировании домой его не берём.

Шаблоны и стили — инлайн в компонентах (`.html`/`.less` рядом нет): папку можно
скопировать целиком, не таща за собой отдельные ассеты и настройки LESS.

Standalone-импорты (частая причина «кнопки без стилей» — забытый модуль):

| Компонент | Импорты |
|---|---|
| контейнер | `NzSpinModule`, `GpoTableHeadComponent`, `GpoTableBodyComponent`, `GpoTableFootComponent` |
| страница с шаблонными ячейками | `GpoTableCellDirective` |
| шапка | — (только Angular core) |
| тело | `NzEmptyModule`, `NzSpinModule`, `NzButtonModule`, `GpoTableRowComponent` |
| строка | `NgTemplateOutlet` |
| футер | `NzPaginationModule`, `DecimalPipe` |

Иконки `nz-icon` в ядре не используются: в пустом проекте пришлось бы отдельно регистрировать
набор иконок. Стрелки сортировки — две текстовые стрелки, активная подсвечивается; загрузка — `nz-spin`.

Публичный API разделён на ядро, адаптеры и отдельный проектный слой, чтобы импорт ядра
не тянул RxJS/HttpClient/стек поиска:

```ts
// index.ts — ядро
export * from './core/gpo-table.types';
export { GPO_TABLE_ACTIONS } from './core/gpo-table-actions';
export { GpoTableComponent } from './components/gpo-table.component';
export { GpoTableCellDirective } from './directives/gpo-table-cell.directive';
export { buildGpoTableSearchFields } from './search/gpo-table-search-fields';
export { combineGridifyFilters } from './core/gpo-table.helpers';

// adapters/index.ts — источники данных
export * from './swagger-gridify-data-source';
export * from './static-gridify-data-source';

// gpo-table-integrations/advanced-search/index.ts — отдельная папка проекта
export { GpoTableSearchComponent } from './gpo-table-search.component';
```

Импорт на странице:

```ts
import { GpoTableColumn, GpoTableComponent } from 'src/app/lib/gpo-table';
import { swaggerGridifyDataSource } from 'src/app/lib/gpo-table/adapters';
```

### 3.5. Контракты

`gpo-table.types.ts`:

```ts
import { TemplateRef } from '@angular/core';

/** Как показать значение ячейки */
export type GpoTableColumnType = 'text' | 'number' | 'date' | 'template';

/** Значение, которое умеет показать таблица без шаблона */
export type GpoTableValue = string | number | boolean | Date | null | undefined;

/** Сортировка одной колонки */
export interface GpoTableSort {
    readonly field: string;
    readonly direction: 'asc' | 'desc';
}

/** Минимальная ширина колонки при изменении размера */
export const GPO_TABLE_COLUMN_MIN_WIDTH = 60;

/** Ширины колонок, сохранённые по полю строки */
export type GpoTableColumnWidths = Readonly<Record<string, number>>;

/** Изменение ширины колонки */
export interface GpoTableColumnResize {
    readonly field: string;
    readonly width: number;
}

/** Действия строки: таблица получает их из сервиса по токену */
export interface GpoTableActions<TRow = Record<string, unknown>> {
    /** Право на редактирование таблицы: boolean или сигнал/функция для динамических прав */
    readonly isEdit: boolean | (() => boolean);
    onEdit?(row: TRow): void | Promise<void>;
    onRemove?(row: TRow): void | Promise<void>;
}

export const GPO_TABLE_ACTIONS = new InjectionToken<GpoTableActions>(
    'GPO_TABLE_ACTIONS',
);

/** Вид поля расширенного поиска */
export type GpoTableSearchKind =
    | 'contains'
    | 'equals'
    | 'word'
    | 'number'
    | 'numberCondition'
    | 'date'
    | 'dateRange'
    | 'select'
    | 'multipleSelect';

/** Опция справочника для select/multipleSelect */
export interface GpoTableSearchOption {
    readonly label: string;
    readonly value: string | number;
}

/** Статичный справочник или ленивый провайдер (вызывается при открытии поиска) */
export type GpoTableSearchDictionary =
    | readonly GpoTableSearchOption[]
    | (() => readonly GpoTableSearchOption[]);

/** Настройка одного поля в расширенном поиске */
export interface GpoTableSearchSettings {
    /** Вид поля; по умолчанию — по типу колонки */
    readonly kind?: GpoTableSearchKind;
    /** Имя колонки Gridify, если отличается от `field` */
    readonly field?: string;
    /** Заголовок в поиске, если отличается от заголовка колонки */
    readonly title?: string;
    /** Справочник для select/multipleSelect */
    readonly dictionary?: GpoTableSearchDictionary;
}

/** Поле, построенное из колонки для расширенного поиска */
export interface GpoTableSearchField {
    /** Ключ формы поиска (обычно `column.field`) */
    readonly key: string;
    /** Имя колонки Gridify */
    readonly field: string;
    readonly title: string;
    readonly kind: GpoTableSearchKind;
    readonly dictionary?: GpoTableSearchDictionary;
}

/** Описание колонки: только представление, без состояния фильтра и сортировки */
export interface GpoTableColumn<TField extends string = string> {
    /** Заголовок */
    readonly title: string;
    /** Ключ поля строки; он же имя поля в Gridify-запросе */
    readonly field: TField;
    /** Тип ячейки; по умолчанию text */
    readonly type?: GpoTableColumnType;
    /** Ширина в любых CSS-единицах; по умолчанию auto, в минимальной ширине таблицы — 120px */
    readonly width?: string;
    /** Можно ли сортировать; по умолчанию false */
    readonly isSortable?: boolean;
    /** Можно ли менять ширину; по умолчанию true */
    readonly isResizable?: boolean;
    /** Показывать ли колонку; по умолчанию true */
    readonly isVisible?: boolean;
    /** Выравнивание; по умолчанию left, для number — right */
    readonly align?: 'left' | 'center' | 'right';
    /** Формат даты Angular; по умолчанию dd.MM.yyyy */
    readonly dateFormat?: string;
    /** Знаков после запятой у number; если не задано — до 2 без лишних нулей */
    readonly numberDigits?: number;
    /** Дополнительный CSS-класс ячейки */
    readonly cssClass?: string;
    /**
     * Настройка поля в расширенном поиске.
     * false — не искать по колонке; объект — переопределить вид/поле/заголовок/справочник.
     * Не задано — автоматически по типу колонки (кроме template и id).
     */
    readonly search?: false | GpoTableSearchSettings;
}

/** Запрос страницы: всё, что нужно источнику данных */
export interface GpoTableQuery {
    readonly page: number;
    readonly pageSize: number;
    readonly sort: GpoTableSort | null;
    /** Итоговая Gridify-строка: базовый filter + searchFilter */
    readonly filter?: string;
}

/** Ответ источника: строки и общее количество */
export interface GpoTablePage<TRow> {
    readonly rows: readonly TRow[];
    readonly total: number;
}

/**
 * Плоские агрегаты по умолчанию: счётчики и суммы.
 * Для вложенной формы используйте свой `dataSource` с явным типом агрегатов.
 */
export type GpoTableAggregates = Readonly<Record<string, number>>;

/** Источник данных таблицы: REST по умолчанию или своя реализация */
export interface GpoTableDataSource<TRow, TAggregates = GpoTableAggregates> {
    getPage(query: GpoTableQuery): Promise<GpoTablePage<TRow>>;
    getAggregates?(query: GpoTableQuery): Promise<TAggregates>;
}

/** Контекст шаблонной ячейки */
export interface GpoTableCellContext<TRow> {
    readonly $implicit: TRow;
    readonly row: TRow;
    readonly value: GpoTableValue;
    readonly column: GpoTableColumn;
    readonly index: number;
}

/** Шаблон ячейки; строка в шаблоне — запись полей, конкретный DTO приводит страница */
export type GpoTableCellTemplate = TemplateRef<GpoTableCellContext<Record<string, unknown>>>;

/** Контекст шаблона футера */
export interface GpoTableFooterContext<TAggregates> {
    readonly $implicit: TAggregates | null;
    readonly isLoading: boolean;
    readonly error: string | null;
    readonly total: number;
    readonly page: number;
    readonly pageSize: number;
}
```

Типы колонок:

| `type` | Что показывает | Форматирование |
|---|---|---|
| `text` (по умолчанию) | `String(value)`, пустое — пустая строка | — |
| `number` | число | `DecimalPipe`/`formatNumber` с локалью приложения (`LOCALE_ID`), разделители разрядов |
| `date` | дата | `formatDate(value, column.dateFormat ?? 'dd.MM.yyyy', LOCALE_ID)`; пусто — `—` |
| `template` | `ng-template` по `field`; если шаблона нет — текст | контекст `GpoTableCellContext` |

`boolean`, `enum`, `status`, `select` и прочие типы из `gpo-lib` в v1 не нужны: их заменяет
`template`. Если одинаковый шаблон повторяется на 3+ страницах — тогда добавляется новый тип,
а не раньше.

#### Поля поиска из колонок

`gpo-table-search-fields.ts` — автоматическая сборка полей расширенного поиска: перечислять
все поля не нужно, только исключения и переопределения.

```ts
import {
    GpoTableColumn,
    GpoTableColumnType,
    GpoTableSearchField,
    GpoTableSearchKind,
    GpoTableSearchSettings,
} from './gpo-table.types';

/** Вид поиска по умолчанию для типа колонки */
const DEFAULT_KIND: Record<GpoTableColumnType, GpoTableSearchKind | null> = {
    text: 'contains',
    number: 'numberCondition',
    date: 'dateRange',
    template: null,
};

/** Технические поля, которые не попадают в поиск без явной настройки */
const DEFAULT_EXCLUDED_FIELDS: readonly string[] = ['id'];

export interface GpoTableSearchBuildOptions {
    /** Дополнительные поля-исключения (кроме id) */
    readonly excludedFields?: readonly string[];
}

/** Построить поля поиска из колонок: исключения и переопределения — в column.search */
export function buildGpoTableSearchFields(
    columns: readonly GpoTableColumn[],
    options: GpoTableSearchBuildOptions = {},
): GpoTableSearchField[] {
    const excluded = new Set([...DEFAULT_EXCLUDED_FIELDS, ...(options.excludedFields ?? [])]);

    return columns.flatMap((column) => {
        if (column.search === false) {
            return [];
        }

        const isExplicit = typeof column.search === 'object';
        // id и другие технические поля не ищем, пока не задан объект явно
        if (!isExplicit && excluded.has(column.field)) {
            return [];
        }

        const settings: GpoTableSearchSettings = isExplicit ? column.search : {};
        // Справочник без kind — это select; иначе вид по типу колонки
        const defaultKind = settings.dictionary ? 'select' : DEFAULT_KIND[column.type ?? 'text'];
        const kind = settings.kind ?? defaultKind;
        if (!kind) {
            return [];
        }

        return [
            {
                key: column.field,
                field: settings.field ?? column.field,
                title: settings.title ?? column.title,
                kind,
                dictionary: settings.dictionary,
            },
        ];
    });
}
```

Правила:

| Настройка колонки | Что попадёт в поиск |
|---|---|
| `type: 'text'` | `contains` |
| `type: 'number'` | `numberCondition` (`=`, `!=`, `>`, `<`) |
| `type: 'date'` | `dateRange` |
| `type: 'template'` | ничего, пока не задан `search.kind` |
| `field: 'id'` | ничего по умолчанию; `search: { kind: 'number' }` включит |
| `search: false` | ничего |
| `search: { kind: 'select', dictionary }` | select со справочником |
| `search: { dictionary }` без `kind` | тоже select (справочник задаёт вид) |
| `search: { kind: 'multipleSelect', dictionary }` | множественный выбор (`_in`) |
| `search: { kind: 'word' }` | поиск по словам |
| `search: { field: 'buyCount' }` | Gridify-поле отличается от поля строки |
| `search: { title: '...' }` | другой заголовок в поиске |

Если ключ строки не `id`, передайте его в `excludedFields`:
`buildGpoTableSearchFields(columns, { excludedFields: [rowKey] })`.

Порядок полей в поиске совпадает с порядком колонок. Скрытые колонки (`isVisible: false`)
по умолчанию остаются в поиске — если не нужны, поставьте `search: false`.

Пример — перечисляем только исключения и справочники:

```ts
const columns: GpoTableColumn[] = [
    { title: 'ID', field: 'id', type: 'number' },                          // не ищется (id)
    { title: 'Наименование', field: 'name' },                              // contains
    { title: 'Количество', field: 'count', type: 'number' },               // numberCondition
    { title: 'Дата создания', field: 'createdAt', type: 'date' },          // dateRange
    { title: 'Комментарий', field: 'comment', search: false },             // убрать из поиска
    {
        title: 'Организация',
        field: 'orgCode',
        search: { kind: 'select', dictionary: () => this.organizationOptions() },
    },
    {
        title: 'Код ТМЦ',
        field: 'mtrCode',
        search: { kind: 'word', field: 'mtrCodeProjection' },              // поле Gridify другое
    },
];
```

`gpo-table.helpers.ts` — функции без зависимостей от проекта (важно для переносимости):

```ts
import { GpoTableValue } from './gpo-table.types';

/** Прочитать поле строки по имени; вложенные объекты показываются только шаблоном */
export function readGpoTableValue<TRow extends object>(row: TRow, field: string): GpoTableValue {
    return Reflect.get(row, field) as GpoTableValue;
}

/** Текст ошибки для пользователя: строка, HttpErrorResponse или Error */
export function getErrorMessage(error: unknown, fallback = 'Произошла ошибка'): string {
    if (typeof error === 'string' && error) {
        return error;
    }
    if (error && typeof error === 'object') {
        const response = error as { error?: unknown; message?: unknown };
        // Сначала тело ответа: там человекочитаемый текст бэкенда
        if (typeof response.error === 'string' && response.error) {
            return response.error;
        }
        if (response.error && typeof response.error === 'object') {
            const body = response.error as Record<string, unknown>;
            const text = body['Message'] ?? body['message'];
            if (typeof text === 'string' && text) {
                return text;
            }
        }
        // Потом message: для обычного Error или сетевой ошибки
        if (typeof response.message === 'string' && response.message) {
            return response.message;
        }
    }
    return fallback;
}

/** AND-склейка Gridify-фильтров: `(base),(search)` — скобки сохраняют OR-группы */
export function combineGridifyFilters(
    ...filters: Array<string | undefined | null>
): string | undefined {
    const parts = filters
        .map((filter) => filter?.trim())
        .filter((filter): filter is string => !!filter);
    return parts.length ? parts.map((filter) => `(${filter})`).join(',') : undefined;
}
```

### 3.6. Состояние: `GpoTableStateService`

Сервис провайдится **на компонент** (`providers: [GpoTableStateService]`), поэтому у каждой
таблицы своё состояние и нет утечки между экземплярами.

```ts
import { computed, Injectable, signal } from '@angular/core';

import { getErrorMessage } from './gpo-table.helpers';
import { GpoTableAggregates, GpoTableDataSource, GpoTableQuery, GpoTableSort } from './gpo-table.types';

/** Начальный запрос: первая страница, без фильтра и сортировки */
const DEFAULT_QUERY: GpoTableQuery = {
    page: 1,
    pageSize: 150,
    sort: null,
    filter: undefined,
};

/** Состояние одной таблицы реестра: запрос, строки, агрегаты */
@Injectable()
export class GpoTableStateService<TRow extends object, TAggregates = GpoTableAggregates> {
    /**
     * Единственный источник истины для запроса.
     * Каждое изменение заменяет объект целиком — старый объект становится «устаревшим запросом».
     */
    readonly query = signal<GpoTableQuery>(DEFAULT_QUERY);

    readonly page = computed(() => this.query().page);
    readonly pageSize = computed(() => this.query().pageSize);
    readonly sort = computed(() => this.query().sort);
    readonly filter = computed(() => this.query().filter);

    readonly rows = signal<readonly TRow[]>([]);
    readonly total = signal(0);
    readonly isLoading = signal(false);
    readonly error = signal<string | null>(null);
    readonly aggregates = signal<TAggregates | null>(null);
    readonly isAggregatesLoading = signal(false);
    readonly aggregatesError = signal<string | null>(null);

    readonly hasRows = computed(() => this.rows().length > 0);
    readonly isEmpty = computed(() => !this.isLoading() && !this.hasRows() && !this.error());

    private _dataSource: GpoTableDataSource<TRow, TAggregates> | null = null;

    /** Подключить источник; вызывает только контейнер */
    connect(dataSource: GpoTableDataSource<TRow, TAggregates>): void {
        if (dataSource === this._dataSource) {
            return;
        }
        this._dataSource = dataSource;
        // Другой источник — старые строки и агрегаты к нему не относятся
        this.rows.set([]);
        this.total.set(0);
        this.aggregates.set(null);
        // Новый объект запроса: ответы старого источника уже не актуальны
        this.query.update((query) => ({ ...query, page: 1 }));
    }

    /** Загрузить строки текущей страницы */
    async reload(): Promise<void> {
        return this._loadRows();
    }

    /** Загрузить агрегаты: тот же filter, что у строк; ошибка не ломает таблицу */
    async reloadAggregates(): Promise<void> {
        return this._loadAggregates();
    }

    /** Строки и агрегаты параллельно — при смене фильтра */
    async reloadAll(): Promise<void> {
        await Promise.all([this._loadRows(), this._loadAggregates()]);
    }

    setPage(page: number): void {
        if (page === this.query().page) {
            return;
        }
        this.query.update((query) => ({ ...query, page }));
    }

    /** Новый размер страницы всегда начинает с первой */
    setPageSize(pageSize: number): void {
        if (pageSize === this.query().pageSize) {
            return;
        }
        this.query.update((query) => ({ ...query, page: 1, pageSize }));
    }

    /** Новая сортировка всегда начинает с первой */
    setSort(sort: GpoTableSort | null): void {
        this.query.update((query) => ({ ...query, page: 1, sort }));
    }

    /** Новый фильтр всегда начинает с первой */
    setFilter(filter?: string): void {
        const nextFilter = filter?.trim() || undefined;
        if (nextFilter === this.query().filter) {
            return;
        }
        this.query.update((query) => ({ ...query, page: 1, filter: nextFilter }));
    }

    private async _loadRows(): Promise<void> {
        const source = this._dataSource;
        if (!source) {
            this.error.set('Источник данных таблицы не подключён');
            return;
        }

        // Снимок запроса — по нему определяем, актуален ли ответ
        const query = this.query();
        this.isLoading.set(true);
        this.error.set(null);

        try {
            const page = await source.getPage(query);

            // Пока шёл запрос, пользователь изменил страницу/фильтр/сортировку —
            // этот ответ уже не показываем
            if (query !== this.query()) {
                return;
            }

            // Страница могла опустеть после удаления — переходим на последнюю
            if (page.rows.length === 0 && page.total > 0 && query.page > 1) {
                const lastPage = Math.max(1, Math.ceil(page.total / query.pageSize));
                if (lastPage !== query.page) {
                    this.query.update((current) => ({ ...current, page: lastPage }));
                    return this.reloadAll();
                }
            }

            this.rows.set(page.rows);
            this.total.set(page.total);
        } catch (error) {
            if (query === this.query()) {
                this.error.set(getErrorMessage(error));
            }
        } finally {
            if (query === this.query()) {
                this.isLoading.set(false);
            }
        }
    }

    private async _loadAggregates(): Promise<void> {
        const source = this._dataSource;
        if (!source?.getAggregates) {
            return;
        }

        // Тот же снимок запроса, что и у строк: ответ старого фильтра не применяем
        const query = this.query();
        this.isAggregatesLoading.set(true);
        this.aggregatesError.set(null);

        try {
            const aggregates = await source.getAggregates(query);
            if (query === this.query()) {
                this.aggregates.set(aggregates);
            }
        } catch (error) {
            if (query === this.query()) {
                this.aggregates.set(null);
                this.aggregatesError.set(getErrorMessage(error));
            }
        } finally {
            if (query === this.query()) {
                this.isAggregatesLoading.set(false);
            }
        }
    }
}
```

Правила:

- **Один источник истины** — `query`. Страница, сортировка и фильтр не хранятся отдельными
  сигналами: они вычисляются из запроса, поэтому не могут разъехаться.
- **Запросы только через `async/await`** (`firstValueFrom` внутри swagger-адаптера), без `subscribe`.
- **`GpoTableQuery` — только для чтения**: источник не меняет объект запроса, иначе сравнение
  снимков перестанет работать.
- **Актуальность ответа** — по снимку `query`, а не по счётчику: ответ применяется, только если
  это всё ещё текущий объект запроса. Смена страницы/фильтра/сортировки или источника заменяет
  объект, и поздний ответ старого запроса отбрасывается.
- **Агрегаты зависят только от фильтра**: их ответ применяется при совпадении источника и `filter`.
  Смена страницы или сортировки не отменяет уже начатый запрос агрегатов, поэтому флаг загрузки
  итогов не остаётся включённым.
- **Пагинация и сортировка** сбрасывают страницу на первую.
- **Агрегаты не блокируют таблицу**: их ошибка попадает в `aggregatesError`, строки остаются.
- **Пустая последняя страница** после удаления автоматически исправляется.

#### Почему не счётчик версий

| Вариант | Почему не выбран |
|---|---|
| `_requestVersion++` | Работает, но это отдельная сущность без смысла в данных: номер запроса приходится не забыть проверить в каждом методе |
| `AbortController` | Транспорт-зависимо: сгенерированные swagger-методы возвращают `Observable` и не принимают `AbortSignal`; отмена потребует обёрток над каждым методом |
| `switchMap` | Естественно отменяет предыдущий запрос, но требует RxJS-поток и подписку — противоречит «только сигналы» |
| Снимок `query` | Объект запроса уже существует и меняется при каждом действии. Сравнение `query === this.query()` — обычная проверка «это ещё тот запрос?», без магических чисел |

У снимка `query` есть осознанное допущение: два одинаковых запроса (например, повторный
`reload()` без смены страницы) считаются эквивалентными, и побеждает ответ, пришедший последним.
Для реестра это безопасно: один и тот же `query` должен вернуть одни и те же данные.

### 3.7. Источник данных: сгенерированный swagger-клиент

Таблица **не знает URL и не создаёт `HttpClient`**. Данные приходят через `dataSource` — тонкую
обёртку над методами `@swagger/api`, которые уже сгенерированы из OpenAPI.

Контракт REST-реестра на бэкенде (имена query-параметров — как в swagger):

```
GET /api/v1/buy/qry?Page=1&PageSize=150&OrderBy=buyReceiptDate desc&Filter=<gridify-строка>
    → PagingOfBuyQry { count: number, data: BuyQry[] }

GET /api/v1/buy/aggregates?Page=1&PageSize=1&Filter=<gridify-строка>
    → BuyAggregatesResponse
```

Сгенерированные методы принимают одни и те же четыре аргумента, поэтому адаптер общий:

```ts
// swagger/api/buy.service.ts
buyGetBuyQry(Page?: number, PageSize?: number, OrderBy?: string, Filter?: string): Observable<PagingOfBuyQry>;
buyGetBuyAggregates(Page?: number, PageSize?: number, OrderBy?: string, Filter?: string): Observable<BuyAggregatesResponse>;
```

`swagger-gridify-data-source.ts`:

```ts
import { Observable, firstValueFrom } from 'rxjs';

import { GpoTableAggregates, GpoTableDataSource, GpoTablePage, GpoTableQuery, GpoTableSort } from './gpo-table.types';

/** Аргументы Gridify-метода swagger: страница, размер, сортировка и фильтр */
export interface SwaggerGridifyQuery {
    readonly page: number;
    readonly pageSize: number;
    readonly orderBy?: string;
    readonly filter?: string;
}

/** Ответ swagger-реестра: PagingOf… структурно совпадает с этой формой */
export interface SwaggerGridifyPage<TRow> {
    readonly count?: number;
    readonly data?: readonly TRow[];
}

/** Сортировка таблицы в строку Gridify для параметра OrderBy */
export function toGridifyOrderBy(sort: GpoTableSort | null): string | undefined {
    return sort ? `${sort.field} ${sort.direction}` : undefined;
}

/**
 * Источник данных поверх сгенерированного swagger-клиента.
 * `loadPage` — метод /qry, `loadAggregates` — необязательный метод /aggregates.
 */
export function swaggerGridifyDataSource<TRow, TAggregates = GpoTableAggregates>(
    loadPage: (query: SwaggerGridifyQuery) => Observable<SwaggerGridifyPage<TRow>>,
    loadAggregates?: (query: SwaggerGridifyQuery) => Observable<TAggregates>,
): GpoTableDataSource<TRow, TAggregates> {
    const toSwaggerQuery = (query: GpoTableQuery): SwaggerGridifyQuery => ({
        page: query.page,
        pageSize: query.pageSize,
        orderBy: toGridifyOrderBy(query.sort),
        filter: query.filter,
    });

    return {
        async getPage(query: GpoTableQuery): Promise<GpoTablePage<TRow>> {
            const response = await firstValueFrom(loadPage(toSwaggerQuery(query)));
            return { rows: response.data ?? [], total: response.count ?? 0 };
        },

        ...(loadAggregates
            ? {
                  async getAggregates(query: GpoTableQuery): Promise<TAggregates> {
                      // Агрегатам нужен только фильтр: страница и сортировка не имеют смысла
                      return firstValueFrom(
                          loadAggregates({ page: 1, pageSize: 1, filter: query.filter }),
                      );
                  },
              }
            : {}),
    };
}
```

Использование на странице — одна строка на метод swagger:

```ts
import { BuyAggregatesResponse, BuyApiService, BuyQry } from '@swagger/api';

private readonly _buyApi = inject(BuyApiService);

readonly dataSource = swaggerGridifyDataSource<BuyQry, BuyAggregatesResponse>(
    (query) => this._buyApi.buyGetBuyQry(query.page, query.pageSize, query.orderBy, query.filter),
    (query) => this._buyApi.buyGetBuyAggregates(query.page, query.pageSize, query.orderBy, query.filter),
);
```

Что это даёт:

- **типы swagger сохраняются**: `BuyQry`, `BuyAggregatesResponse` приходят из `@swagger/api`,
  а не описываются руками;
- **никаких URL-строк** в шаблоне и компоненте таблицы;
- методы передаются замыканием, а не ссылкой: сохраняется `this` сгенерированного сервиса
  и можно добавить свои аргументы (режим отчёта, предприятия);
- **доп. параметры** (режим отчёта, код предприятия, филиал) передаются в замыкании
  `loadPage`: `(query) => this._api.getItems(query.page, query.pageSize, query.orderBy, query.filter, this.reportParam())`;
  при изменении такого параметра страница вызывает `table.reload()`;
- **агрегаты опциональны**: не передали `loadAggregates` — второго запроса нет;
- **один запрос строк** на страницу/сортировку/фильтр; агрегаты — отдельный запрос только
  при смене фильтра и при явном `reload()`.

#### `staticGridifyDataSource` — дом и демо

Для пустого проекта без бэкенда в адаптерах есть источник в памяти: пагинация и сортировка
считаются на клиенте, фильтр можно передать предикатом.

```ts
import { readGpoTableValue } from '../gpo-table.helpers';
import { GpoTableDataSource, GpoTableValue } from '../gpo-table.types';

/** Источник для демо: строки в памяти, пагинация и сортировка на клиенте */
export function staticGridifyDataSource<TRow extends object>(
    rows: readonly TRow[],
    isMatch?: (row: TRow, filter?: string) => boolean,
): GpoTableDataSource<TRow> {
    return {
        async getPage(query) {
            const matched =
                query.filter && isMatch ? rows.filter((row) => isMatch(row, query.filter)) : [...rows];

            const sorted = query.sort
                ? matched.sort((a, b) =>
                      compareValues(
                          readGpoTableValue(a, query.sort!.field),
                          readGpoTableValue(b, query.sort!.field),
                          query.sort!.direction,
                      ),
                  )
                : matched;

            const start = (query.page - 1) * query.pageSize;
            return { rows: sorted.slice(start, start + query.pageSize), total: sorted.length };
        },
    };
}

function compareValues(a: GpoTableValue, b: GpoTableValue, direction: 'asc' | 'desc'): number {
    const result =
        typeof a === 'number' && typeof b === 'number'
            ? a - b
            : String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true });
    return direction === 'asc' ? result : -result;
}
```

На работе этот адаптер не используется; он нужен, чтобы дома поднимать таблицу без API
и проверять пагинацию, сортировку, шаблоны ячеек и состояния.

Если у сущности другой контракт ответа или нужна постобработка строк, страница реализует
`GpoTableDataSource` вручную — это тот же интерфейс, что и у адаптера:

```ts
readonly dataSource: GpoTableDataSource<ItemRow> = {
    getPage: async (query) => {
        const response = await firstValueFrom(this._api.getItems(/* ... */));
        return { rows: this.prepareRows(response.data), total: response.count };
    },
};
```

Что переиспользуется из существующего стека:

| Переиспользуем | Не используем в v1 |
|---|---|
| `@swagger/api`: сгенерированные методы `/qry` и `/aggregates` | `BaseTable`, `GridifySearchTable`, `GridifyRepository` |
| `TypedGridifyBuilder` на странице — для сборки `filter` | `ColumnFiltered`, `ETypeColumn`, `ETypeColumnFilter` |
| `gridify-client` внутри `TypedGridifyBuilder` | `gridifyGet`/URL-хелперы |

`GridifySearchTable`/`GridifyRepository` завязаны на `BaseTable` и модель таблицы страницы.
Новой таблице они не нужны: её состояние — сигналы, а страница передаёт `dataSource` и готовую
Gridify-строку. Старые классы остаются для ещё не мигрированных страниц.

### 3.8. Компоненты и их API

#### `GpoTableComponent` — контейнер

Входы:

| Вход | Тип | Назначение |
|---|---|---|
| `columns` | `readonly GpoTableColumn[]` (required) | Описание колонок |
| `dataSource` | `GpoTableDataSource<TRow, TAggregates>` (required) | Обёртка над swagger-методами `/qry` и `/aggregates` |
| `filter` | `string` | Базовый Gridify-фильтр страницы (постоянные условия) |
| `searchFilter` | `string` | Gridify-фильтр расширенного поиска; склеивается с `filter` через AND |
| `pageSize` | `number` (150) | Начальный размер страницы |
| `pageSizeOptions` | `readonly number[]` | Варианты размера страницы |
| `rowKey` | `string` (`'id'`) | Поле уникального ключа строки для `track` |
| `scrollWidth` | `string` | Минимальная ширина таблицы; горизонтальный скролл появляется при переполнении |
| `storageKey` | `string` | Ключ `localStorage` для ширин колонок; без него ширины не сохраняются |
| `bottomOffset` | `number` (`0`) | Отступ снизу вне таблицы: padding страницы или внешний футер |
| `emptyText` | `string` (`'Данные не найдены'`) | Текст пустого состояния |
| `isShowFooter` | `boolean` (`true`) | Показывать встроенный футер (итоги + пагинация) |
| `aggregatesTemplate` | `TemplateRef<GpoTableFooterContext<TAggregates>>` | Шаблон агрегатов во встроенном футере |

Выходы:

| Выход | Тип | Когда |
|---|---|---|
| `rowClick` | `TRow` | Клик по строке |
| `rowDblClick` | `TRow` | Двойной клик по строке |
| `pageChange` | `number` | Смена страницы |
| `pageSizeChange` | `number` | Смена размера страницы |
| `sortChange` | `GpoTableSort \| null` | Смена сортировки |
| `aggregatesLoaded` | `TAggregates` | Агрегаты загружены |
| `totalChange` | `number` | Изменилось общее количество записей |

Публичные методы:

```ts
/** Перезагрузить строки и агрегаты (после сохранения, удаления и т.п.) */
reload(): Promise<void>;
/** Пересчитать высоту таблицы, если шапка страницы изменилась без DOM-событий */
refreshHeight(): void;
/** Сбросить ширины колонок и удалить их из localStorage */
resetColumnWidths(): void;
/** Перейти на страницу; для своего футера или внешней панели */
goToPage(page: number): Promise<void>;
/** Сменить размер страницы; для своего футера или внешней панели */
changePageSize(size: number): Promise<void>;
/** Сменить сортировку; для своего заголовка или внешней панели */
changeSort(sort: GpoTableSort | null): Promise<void>;
```

Контент-слоты:

```html
<!-- шаблоны ячеек -->
<ng-template gpoTableCell="field" let-row let-value="value" let-index="index">...</ng-template>

<!-- произвольный контент над таблицей -->
<div gpoTableHeader>...</div>

<!-- произвольный контент под таблицей -->
<div gpoTableFooter>...</div>
```

Инициализация и реакция на входы:

```ts
export class GpoTableComponent<TRow extends object, TAggregates = GpoTableAggregates> {
    private readonly _state = inject(GpoTableStateService) as GpoTableStateService<TRow, TAggregates>;

    readonly columns = input.required<readonly GpoTableColumn[]>();
    readonly dataSource = input.required<GpoTableDataSource<TRow, TAggregates>>();
    readonly filter = input<string>();
    readonly searchFilter = input<string>();
    readonly pageSize = input(150);
    readonly pageSizeOptions = input<readonly number[]>([10, 30, 50, 100, 150, 200, 250]);
    readonly isShowFooter = input(true);
    readonly aggregatesLoaded = output<TAggregates>();
    readonly totalChange = output<number>();
    // ... остальные входы и выходы

    protected readonly state = this._state;
    protected readonly visibleColumns = computed(() => this.columns().filter((column) => column.isVisible !== false));

    private _connectedSource: GpoTableDataSource<TRow, TAggregates> | null = null;
    private _lastFilter: string | undefined = undefined;
    private _isInitialPageSize = true;

    constructor() {
        // Размер страницы: при инициализации только задаём значение (загрузку сделает
        // эффект ниже), при последующем изменении входа — перезагружаем
        effect(() => {
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
        }, { allowSignalWrites: true });

        // Источник, базовый фильтр и фильтр расширенного поиска; untracked — чтобы
        // загрузка не читала состояние в реактивном контексте и не запускала эффект повторно
        effect(() => {
            const dataSource = this.dataSource();
            const filter = combineGridifyFilters(this.filter(), this.searchFilter());

            untracked(() => {
                const isSourceChanged = dataSource !== this._connectedSource;
                const isFilterChanged = filter !== this._lastFilter;
                if (!isSourceChanged && !isFilterChanged) {
                    return;
                }

                this._connectedSource = dataSource;
                this._lastFilter = filter;
                const pageBefore = this._state.page();
                this._state.connect(dataSource);
                this._state.setFilter(filter);
                // Сброс на первую страницу — тоже изменение страницы для внешних панелей
                if (this._state.page() !== pageBefore) {
                    this.pageChange.emit(this._state.page());
                }
                void this._state.reloadAll();
            });
        }, { allowSignalWrites: true });

        // Отдать наружу итоги и агрегаты для своих header/footer-панелей.
        // allowSignalWrites — обработчик страницы может записать сигнал (например, total.set)
        effect(() => this.totalChange.emit(this._state.total()), { allowSignalWrites: true });
        effect(() => {
            const aggregates = this._state.aggregates();
            if (aggregates !== null) {
                this.aggregatesLoaded.emit(aggregates);
            }
        }, { allowSignalWrites: true });
    }

    reload(): Promise<void> {
        return this._state.reloadAll();
    }

    goToPage(page: number): Promise<void> {
        if (page === this._state.page()) {
            return Promise.resolve();
        }
        this._state.setPage(page);
        this.pageChange.emit(page);
        return this._state.reload();
    }

    changePageSize(size: number): Promise<void> {
        if (size === this._state.pageSize()) {
            return Promise.resolve();
        }
        const pageBefore = this._state.page();
        this._state.setPageSize(size);
        this.pageSizeChange.emit(size);
        if (this._state.page() !== pageBefore) {
            this.pageChange.emit(this._state.page());
        }
        return this._state.reload();
    }

    changeSort(sort: GpoTableSort | null): Promise<void> {
        const pageBefore = this._state.page();
        this._state.setSort(sort);
        this.sortChange.emit(sort);
        if (this._state.page() !== pageBefore) {
            this.pageChange.emit(this._state.page());
        }
        return this._state.reload();
    }
}
```

Важно:

- при смене фильтра грузятся **и строки, и агрегаты**;
- при смене страницы, размера и сортировки — **только строки** (агрегаты от них не зависят);
- `goToPage`/`changePageSize` игнорируют повторное событие с текущим значением:
  `nz-pagination` вместе со сменой размера присылает ещё и последнюю страницу, поэтому
  `changePageSize` на текущий тик подавляет `goToPage` — смена размера всегда возвращает
  на первую страницу, лишнего запроса не будет;
- `dataSource` должен быть стабильным полем класса: эффект сравнивает источник по ссылке,
  а `filter` — по значению;
- доп. параметры запроса (режим отчёта, предприятия) передаются в замыкании `loadPage`
  `dataSource`; при их изменении страница вызывает `table.reload()`;
- `dataSource` обязателен: без него Angular сообщит об ошибке шаблона, а не покажет пустую таблицу.

#### `GpoTableHeadComponent`

Селектор: `thead[gpo-table-head]`.

| Вход | Тип | Назначение |
|---|---|---|
| `columns` | `readonly GpoTableColumn[]` | Видимые колонки |
| `sort` | `GpoTableSort \| null` | Текущая сортировка |

| Выход | Тип | Когда |
|---|---|---|
| `sortChange` | `GpoTableSort \| null` | Клик по сортируемой колонке |

Шаблон:

```html
<tr>
    @for (column of columns(); track $index) {
        <th
            [style.width]="column.width"
            [style.text-align]="column.align ?? (column.type === 'number' ? 'right' : 'left')"
            [class]="column.cssClass ?? ''"
            [attr.aria-sort]="getAriaSort(column)">
            @if (column.isSortable) {
                <button type="button" class="gpo-table__sort" (click)="toggleSort(column)">
                    <span class="gpo-table__sort-title">{{ column.title }}</span>
                    <span class="gpo-table__sorter" aria-hidden="true">
                        <span
                            class="gpo-table__sorter-arrow"
                            [class.gpo-table__sorter-arrow--active]="isSortActive(column, 'asc')">▲</span>
                        <span
                            class="gpo-table__sorter-arrow"
                            [class.gpo-table__sorter-arrow--active]="isSortActive(column, 'desc')">▼</span>
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
```

```ts
/** Активна ли стрелка указанного направления */
protected isSortActive(column: GpoTableColumn, direction: 'asc' | 'desc'): boolean {
    const sort = this.sort();
    return sort?.field === column.field && sort.direction === direction;
}
```

Цикл сортировки: клик 1 — `asc`, клик 2 — `desc`, клик 3 — без сортировки (бэкенд применяет
свой порядок по умолчанию).

#### `GpoTableBodyComponent`

Селектор: `tbody[gpo-table-body]`.

| Вход | Тип | Назначение |
|---|---|---|
| `columns` | `readonly GpoTableColumn[]` | Видимые колонки |
| `rows` | `readonly TRow[]` | Строки текущей страницы |
| `templates` | `ReadonlyMap<string, GpoTableCellTemplate>` | Шаблоны ячеек |
| `rowKey` | `string` | Поле уникального ключа |
| `isLoading` | `boolean` | Загрузка |
| `error` | `string \| null` | Текст ошибки |
| `emptyText` | `string` | Текст пустого состояния |

| Выход | Тип | Когда |
|---|---|---|
| `rowClick` | `TRow` | Клик по строке |
| `rowDblClick` | `TRow` | Двойной клик |
| `retry` | `void` | Кнопка «Повторить» в состоянии ошибки |

Порядок состояний:

1. `error` — строка с текстом ошибки и кнопкой «Повторить»;
2. `isLoading && !rows.length` — «Загрузка данных»;
3. `!rows.length` — `nz-empty` с `emptyText`;
4. иначе — `@for` строк.

```html
@if (error()) {
    <tr class="gpo-table__state-row">
        <td [attr.colspan]="columns().length">
            <div class="gpo-table__state">
                <span>{{ error() }}</span>
                <button nz-button nzSize="small" (click)="retry.emit()">Повторить</button>
            </div>
        </td>
    </tr>
} @else if (isLoading() && !rows().length) {
    <tr class="gpo-table__state-row">
        <td [attr.colspan]="columns().length">
            <div class="gpo-table__state">
                <nz-spin nzSimple nzSize="small"></nz-spin>
                <span>Загрузка данных</span>
            </div>
        </td>
    </tr>
} @else if (!rows().length) {
    <tr class="gpo-table__state-row">
        <td [attr.colspan]="columns().length">
            <nz-empty [nzNotFoundContent]="emptyText()"></nz-empty>
        </td>
    </tr>
} @else {
    @for (row of rows(); track trackRow($index, row)) {
        <tr
            gpo-table-row
            [row]="row"
            [index]="$index"
            [columns]="columns()"
            [templates]="templates()"
            (click)="rowClick.emit(row)"
            (dblclick)="rowDblClick.emit(row)">
        </tr>
    }
}
```

```ts
/** Устойчивый ключ строки; при отсутствии rowKey — индекс */
protected trackRow(index: number, row: TRow): unknown {
    return readGpoTableValue(row, this.rowKey()) ?? index;
}
```

`readGpoTableValue` — общий хелпер из `gpo-table.helpers.ts` (используется и строкой, и телом).

#### `GpoTableRowComponent`

Селектор: `tr[gpo-table-row]`.

| Вход | Тип | Назначение |
|---|---|---|
| `row` | `TRow` (required) | Строка |
| `index` | `number` (required) | Индекс для контекста шаблона |
| `columns` | `readonly GpoTableColumn[]` (required) | Колонки |
| `templates` | `ReadonlyMap<string, GpoTableCellTemplate>` (required) | Шаблоны |

Строка не форматирует значения в шаблоне «на лету», а один раз собирает представление ячеек:

```ts
import { formatDate, formatNumber, LOCALE_ID } from '@angular/common';
import { computed, inject } from '@angular/core';

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

protected readonly cells = computed<GpoTableCellView[]>(() =>
    this.columns().map((column, index) => this.prepareCell(column, index)),
);

// Локаль приходит из приложения: в рабочем проекте — ru, дома в пустом — en-US
private readonly _locale = inject(LOCALE_ID);

private prepareCell(column: GpoTableColumn, index: number): GpoTableCellView {
    const value = readGpoTableValue(this.row(), column.field);
    const type = column.type ?? 'text';
    const template = this.templates().get(column.field) ?? null;

    let text = '';
    if (type === 'date') {
        text = value
            ? formatDate(value as string | number | Date, column.dateFormat ?? 'dd.MM.yyyy', this._locale)
            : '—';
    } else if (type === 'number') {
        text =
            typeof value === 'number'
                ? formatNumber(value, this._locale, `1.0-${column.numberDigits ?? 2}`)
                : '—';
    } else if (value !== null && value !== undefined) {
        text = String(value);
    }

    // Таблица не знает DTO строки: шаблон получает запись полей
    const row = this.row() as unknown as Record<string, unknown>;

    return {
        column,
        text,
        template,
        context: { $implicit: row, row, value, column, index },
        align: column.align ?? (type === 'number' ? 'right' : 'left'),
        className: [type === 'number' ? 'gpo-table__cell--number' : '', column.cssClass ?? '']
            .filter(Boolean)
            .join(' '),
        title: template ? '' : text,
    };
}
```

Шаблон строки:

```html
@for (cell of cells(); track $index) {
    <td [class]="cell.className" [style.text-align]="cell.align" [title]="cell.title">
        @if (cell.template) {
            <ng-container
                [ngTemplateOutlet]="cell.template"
                [ngTemplateOutletContext]="cell.context">
            </ng-container>
        } @else {
            {{ cell.text }}
        }
    </td>
}
```

Чтение поля — одно контролируемое приведение типа в библиотеке (`gpo-table.helpers.ts`,
см. §3.5).

#### `GpoTableFootComponent`

Селектор: `gpo-table-foot`.

| Вход | Тип | Назначение |
|---|---|---|
| `total` | `number` (required) | Всего записей |
| `page` | `number` (required) | Текущая страница |
| `pageSize` | `number` (required) | Размер страницы |
| `pageSizeOptions` | `readonly number[]` | Варианты размера |
| `aggregates` | `TAggregates \| null` | Агрегаты |
| `isAggregatesLoading` | `boolean` | Загрузка агрегатов |
| `aggregatesError` | `string \| null` | Ошибка агрегатов |
| `aggregatesTemplate` | `TemplateRef<GpoTableFooterContext<TAggregates>>` | Кастомный левый блок |

| Выход | Тип |
|---|---|
| `pageChange` | `number` |
| `pageSizeChange` | `number` |

```ts
// nz-pagination принимает обычный массив, а вход таблицы — readonly
protected readonly pageSizeOptionsArray = computed(() => [...this.pageSizeOptions()]);
```

```html
<div class="gpo-table__footer">
    <div class="gpo-table__summary">
        @if (aggregatesTemplate()) {
            <ng-container
                [ngTemplateOutlet]="aggregatesTemplate()"
                [ngTemplateOutletContext]="{
                    $implicit: aggregates(),
                    isLoading: isAggregatesLoading(),
                    error: aggregatesError(),
                    total: total()
                }">
            </ng-container>
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
            (nzPageSizeChange)="pageSizeChange.emit($event)">
        </nz-pagination>
    }
</div>
```

#### Шаблон контейнера

```html
<!-- контент над таблицей: заголовок, кнопки, поиск -->
<ng-content select="[gpoTableHeader]" />

<nz-spin [nzSpinning]="isTableLoading()">
    <div class="ant-table">
        <div class="ant-table-container">
            <div
                #scrollArea
                class="ant-table-content gpo-table__scroll"
                [style.max-height.px]="scrollMaxHeight()"
                [style.overflow-x]="scrollWidth() ? 'auto' : 'hidden'">
                <table [style.min-width]="scrollWidth()">
                    <thead
                        class="ant-table-thead"
                        gpo-table-head
                        [columns]="visibleColumns()"
                        [sort]="state.sort()"
                        (sortChange)="changeSort($event)">
                    </thead>

                    <tbody
                        class="ant-table-tbody"
                        gpo-table-body
                        [columns]="visibleColumns()"
                        [rows]="state.rows()"
                        [templates]="templatesByField()"
                        [rowKey]="rowKey()"
                        [isLoading]="state.isLoading()"
                        [error]="state.error()"
                        [emptyText]="emptyText()"
                        (rowClick)="rowClick.emit($event)"
                        (rowDblClick)="rowDblClick.emit($event)"
                        (retry)="reload()">
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</nz-spin>

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
            (pageSizeChange)="changePageSize($event)">
        </gpo-table-foot>
    }

    <ng-content select="[gpoTableFooter]" />
</div>
```

`isTableLoading` — спиннер поверх таблицы только когда уже есть строки; при первой загрузке
показывается строка «Загрузка данных», а не пустая таблица под оверлеем:

```ts
protected readonly isTableLoading = computed(() => this.state.isLoading() && this.state.hasRows());
protected readonly scrollMaxHeight = computed(() => this._heightService.maxHeight());
```

`scrollMaxHeight` приходит из `GpoTableHeightService` (§3.8.1): область таблицы получает
`max-height`, поэтому при малом числе строк таблица не растягивается, а при большом — скроллится.

#### 3.8.1. `GpoTableHeightService`

Сервис провайдится на компонент рядом с состоянием. Он измеряет верх области таблицы и высоту
блока под ней (футер + слот `gpoTableFooter`), вычитает `bottomOffset` и отдаёт сигнал
`maxHeight`. Слушает `window.resize`, `visualViewport.resize` и `ResizeObserver` на `body`
и элементах таблицы; пересчёт — не чаще одного кадра.

- высота всегда ограничивается `max-height`, а не фиксируется — 5 строк останутся 5 строками;
- шапка таблицы входит в измеряемую область и остаётся sticky;
- футер и контент под таблицей измеряются, поэтому пагинация и примечания не перекрывают таблицу;
- `bottomOffset` учитывает padding страницы и внешний футер за пределами компонента;
- минимальная высота — 200px: на низком экране страница проскроллится, таблица не схлопнется;
- горизонтальный скролл появляется только при переполнении; `scrollWidth` задаёт минимальную ширину таблицы.

#### 3.8.2. Resize колонок и хранение ширин

У каждой колонки, кроме `isResizable: false`, в шапке есть ручка у правого края. Перетаскивание
меняет ширину `th` вживую, отпускание отдаёт итоговую ширину в контейнер. С клавиатуры работают
`←`/`→`, с `Shift` — крупнее; минимум — 60px.

- `GpoTableColumnResizeDirective` — только pointer/keyboard и ширина `th`, ничего не знает
  о `localStorage`;
- контейнер хранит `signal<GpoTableColumnWidths>` и строит эффективные колонки:
  сохранённая ширина перекрывает `column.width`;
- `GpoTableColumnWidthService` читает и пишет ключ
  `gpo-table-columns:<storageKey>`; битые, нечисловые и слишком маленькие значения
  отбрасываются; ошибки storage не ломают таблицу;
- без `storageKey` resize работает, но ширины живут только в памяти;
- `resetColumnWidths()` очищает ширины и удаляет ключ;
- ширина хранится по `field`, поэтому поля колонок должны быть уникальны.

#### 3.8.3. Действия строки

Таблица не получает действия через входы. Страница провайдит сервис под токеном
`GPO_TABLE_ACTIONS`; таблица инжектит его опционально и строит первую колонку «⋯».

```ts
@Injectable()
export class ItemsActions implements GpoTableActions<ItemRow> {
    readonly isEdit = true;

    onEdit(row: ItemRow): void {
        // модалка редактирования
    }

    onRemove(row: ItemRow): void {
        // подтверждение и удаление
    }
}

@Component({
    providers: [{ provide: GPO_TABLE_ACTIONS, useClass: ItemsActions }],
})
export class ItemsComponent {}
```

- `isEdit` — единое право: `true` разрешает и редактирование, и удаление; `false` скрывает колонку;
  можно передать сигнал или функцию — таблица пересчитает колонку при смене прав;
- «Редактировать» показывается при наличии `onEdit`, «Удалить» — при наличии `onRemove`;
- оба метода не заданы — колонки действий нет;
- подтверждение удаления и обновление данных — ответственность страницы;
  после успешного действия она вызывает `table.reload()`;
- колонка фиксированной ширины 64px, не сортируется и не ресайзится;
- новые флаги и действия добавляются в интерфейс сервиса, а не во входы таблицы.

### 3.9. Директива шаблонных ячеек

```ts
import { Directive, input } from '@angular/core';

import { GpoTableCellTemplate } from './gpo-table.types';

/** Шаблон ячейки: <ng-template gpoTableCell="field">...</ng-template> */
@Directive({
    selector: 'ng-template[gpoTableCell]',
    standalone: true,
})
export class GpoTableCellDirective {
    /** Поле колонки, к которой относится шаблон; приходит из атрибута gpoTableCell */
    readonly gpoTableCell = input.required<string>();

    constructor(public readonly templateRef: GpoTableCellTemplate) {}
}
```

Контейнер собирает карту шаблонов:

```ts
private readonly _cellTemplates = contentChildren(GpoTableCellDirective);

protected readonly templatesByField = computed(() => {
    const map = new Map<string, GpoTableCellTemplate>();
    for (const directive of this._cellTemplates()) {
        map.set(directive.gpoTableCell(), directive.templateRef);
    }
    return map;
});
```

Использование на странице (в компоненте страницы импортируется `GpoTableCellDirective`):

```html
<gpo-table [dataSource]="dataSource" [columns]="columns" [filter]="filter()">
    <ng-template gpoTableCell="code" let-row let-value="value">
        <a (click)="$event.stopPropagation(); openItem(row)">{{ value }}</a>
    </ng-template>

    <ng-template gpoTableCell="id" let-row>
        <button nz-button nzSize="small" (click)="$event.stopPropagation(); edit(row)">Изменить</button>
    </ng-template>
</gpo-table>
```

Шаблоны ячеек кладутся прямыми детьми `gpo-table`, а не внутрь `gpoTableHeader`
или `gpoTableFooter`: контейнер ищет их контент-запросом, а не проецирует.

Шаблон получает контекст `GpoTableCellContext`: `$implicit`/`row`, `value`, `column`, `index`.
`row` типизирован как `Record<string, unknown>` — таблица не знает конкретный DTO. На странице
обработчик принимает эту запись и один раз приводит её к своему типу:

```ts
edit(row: Record<string, unknown>): void {
    this.openEdit(row['id'] as number);
}
```

Клик внутри шаблона всплывает до строки — если он не должен открывать строку, нужен
`$event.stopPropagation()`.

### 3.10. Состояния UI

| Состояние | Что видит пользователь |
|---|---|
| Первая загрузка | строка «Загрузка данных» в теле таблицы |
| Повторная загрузка | старые строки + спиннер поверх таблицы (`nzLoading`) |
| Пусто | `nz-empty`, «Данные не найдены» (настраивается через `emptyText`) |
| Ошибка строк | строка с текстом ошибки и кнопкой «Повторить» |
| Ошибка агрегатов | таблица работает; ошибка доступна в шаблоне футера |

Тексты — по правилам проекта: «Загрузка данных», «Данные не найдены», «Повторить»,
«Всего записей:». Ошибка запроса — через локальный `getErrorMessage(error)`, без HTTP-статусов
и сырых сообщений браузера.

### 3.11. Стили

Минимум, который даёт таблице аккуратный вид без ручных классов на странице:

```css
:host {
    display: block;
}

table {
    width: 100%;
    table-layout: fixed;
}

:host ::ng-deep .ant-table-tbody > tr > td {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.gpo-table__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 0;
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
    transition: color 0.2s, background-color 0.2s;
}

.gpo-table__sorter-arrow--active {
    background: #e6f4ff;
    color: #1677ff;
}

.gpo-table__state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 120px;
}
```

Шаблонные ячейки получают `white-space: nowrap` от общего правила `td`: если внутри кнопки
или ссылки, это нормально; если нужен перенос — страница переопределяет `white-space` в своём
CSS для конкретной ячейки/класса.

---

### 3.12. Контент над и под таблицей (header/footer)

Уточнение терминов: **шапка таблицы** — это `<thead>` с колонками (её рисует
`GpoTableHeadComponent`); **header-контент** — панель над таблицей (заголовок, кнопки,
поиск, легенда). Ниже — про второе.

Контент над и под таблицей — это обычный `ng-content`, потому что он находится **вне**
`<nz-table>` и не участвует в раскладке `<table>`:

```html
<gpo-table
    [dataSource]="dataSource"
    [columns]="columns"
    (rowClick)="open($event)">

    <!-- над таблицей: заголовок, кнопки, поиск, переключатели -->
    <div gpoTableHeader class="items-toolbar">
        <button nz-button nzType="primary" (click)="create()">Создать</button>
        <input nz-input placeholder="Поиск" [ngModel]="quickSearch()" (ngModelChange)="quickSearch.set($event)" />
    </div>

    <!-- под таблицей: примечание, легенда, свои итоги -->
    <div gpoTableFooter class="items-note">
        Выбрано записей: {{ selectedCount() }}
    </div>
</gpo-table>
```

Правила:

- `gpoTableHeader` — произвольная разметка и логика страницы над таблицей;
- `gpoTableFooter` — произвольная разметка под таблицей (после встроенного футера);
- ядро таблицы не знает, что в этих слотах: страница сама импортирует нужные модули
  (`NzButtonModule`, `NzInputModule`, `FormsModule` и т.п.);
- если контента нет — слот ничего не рисует;
- для «своей» панели не нужны отдельные входы `title`, `customButtons`, `legend` — всё это
  заменяет header-слот.

#### Если нужен полностью свой футер

Встроенный футер (итоги + пагинация) можно отключить:

```html
<gpo-table
    #table
    [isShowFooter]="false"
    [dataSource]="dataSource"
    [columns]="columns"
    (totalChange)="total.set($event)"
    (pageChange)="page.set($event)"
    (pageSizeChange)="pageSize.set($event)">

    <div gpoTableFooter class="custom-footer">
        <span>Всего: {{ total() }}</span>
        <nz-pagination
            [nzPageIndex]="page()"
            [nzTotal]="total()"
            [nzPageSize]="pageSize()"
            (nzPageIndexChange)="table.goToPage($event)"
            (nzPageSizeChange)="table.changePageSize($event)">
        </nz-pagination>
    </div>
</gpo-table>
```

```ts
// Значения для своего футера страница хранит сама
readonly total = signal(0);
readonly page = signal(1);
readonly pageSize = signal(150);
```

Компонент страницы подключает `NzPaginationModule` (и другие модули, которые использует
в своём футере).

Публичные методы контейнера для внешних контролов:

```ts
goToPage(page: number): Promise<void>;
changePageSize(size: number): Promise<void>;
changeSort(sort: GpoTableSort | null): Promise<void>;
reload(): Promise<void>;
refreshHeight(): void;
```

Методы возвращают Promise: панель над таблицей может показать свой спиннер или заблокировать
кнопку до завершения загрузки.

Чтобы страница знала общее количество для своего футера, у таблицы есть выход `totalChange`.
Если header-панели нужно состояние таблицы, используйте `(pageChange)`, `(pageSizeChange)`,
`(sortChange)`, `(aggregatesLoaded)`, `(totalChange)` или ссылку `viewChild`.

#### Почему не `ng-content` для `<thead>`/`<tbody>`

Содержимое `ng-content` проецируется в контейнер, а не перепроецируется внутрь `<nz-table>`.
Если положить в слот готовый `<thead>`, он окажется вне внутренней `<table>` ng-zorro,
и колонки разъедутся. Поэтому:

- контент **над/под** таблицей — `ng-content` (`gpoTableHeader` / `gpoTableFooter`);
- ячейки **внутри** таблицы — `ng-template gpoTableCell`;
- если понадобится полностью своё тело или строка — это отдельный слой (экспорт
  `head/body/row/foot` и сборка своего `<nz-table>`), а не `ng-content`.

### 3.13. Автоматический расширенный поиск

Цель: в таблице есть флаг, по которому показывается кнопка «Расширенный поиск»; поля drawer'а
строятся **из колонок автоматически**, а страница задаёт только исключения и справочники.

Разделение ответственности:

| Слой | Что делает | Где живёт |
|---|---|---|
| Ядро | `buildGpoTableSearchFields(columns)` — поля из колонок, `column.search` — исключения/переопределения | `gpo-table/search/gpo-table-search-fields.ts`, переносимо |
| Интеграция | Кнопка + drawer `app-advanced-search-rest`, маппинг полей в `SearchItem`, сборка Gridify-строки | `src/app/lib/gpo-table-integrations/advanced-search/`, зависит от стека проекта |
| Таблица | Принимает `searchFilter` и склеивает его с базовым `filter` через AND | ядро |

#### Настройка колонки

Перечислять все поля не нужно — только отклонения:

```ts
const columns: GpoTableColumn[] = [
    { title: 'ID', field: 'id', type: 'number' },                          // id не ищется по умолчанию
    { title: 'Наименование', field: 'name' },                              // text → contains
    { title: 'Количество', field: 'count', type: 'number' },               // number → numberCondition
    { title: 'Дата создания', field: 'createdAt', type: 'date' },          // date → dateRange
    { title: 'Комментарий', field: 'comment', search: false },             // убрать из поиска
    {
        title: 'Организация',
        field: 'orgCode',
        search: { kind: 'select', dictionary: () => this.organizationOptions() },
    },
    {
        title: 'Код ТМЦ',
        field: 'mtrCode',
        search: { kind: 'word', field: 'mtrCodeProjection', title: 'Код ТМЦ (поиск по словам)' },
    },
];
```

Справочник — статический массив или ленивый провайдер:

```ts
interface GpoTableSearchOption {
    label: string;
    value: string | number;
}

// статический
search: { kind: 'select', dictionary: [{ label: 'Да', value: 1 }, { label: 'Нет', value: 0 }] }

// ленивый: вызовется при открытии drawer'а
search: { kind: 'select', dictionary: () => this.directory.organizations() }
```

#### Использование на странице

```ts
import { GpoTableSearchComponent } from 'src/app/lib/gpo-table-integrations/advanced-search';
```

```html
<gpo-table
    [dataSource]="dataSource"
    [columns]="columns"
    [filter]="baseFilter()"
    [searchFilter]="searchFilter()">

    <app-gpo-table-search
        gpoTableHeader
        [columns]="columns"
        [isShowButton]="canUseAdvancedSearch()"
        (filterChange)="searchFilter.set($event)" />
</gpo-table>
```

- `isShowButton` — тот самый флаг: `false` — кнопка не показывается и поиск недоступен.
  Флаг живёт на интеграции, а не на таблице: ядро не знает про поиск; при желании его можно
  обернуть в `@if` или тонкую обёртку;
- `app-gpo-table-search` — проект-специфичная интеграция; в ядро не входит;
- `searchFilter` — Gridify-строка от поиска; таблица склеивает её с базовым `filter`
  через `combineGridifyFilters` (`(base),(search)`), сбрасывает страницу и делает один запрос.

#### Что делает интеграция

`gpo-table-search.component.ts` (схема):

```ts
@Component({
    selector: 'app-gpo-table-search',
    standalone: true,
    imports: [AdvancedSearchButtonComponent, RestAdvancedSearchComponent],
    template: `
        @if (isShowButton()) {
            <app-advanced-search-button [filter]="flatFilter()" (openSearch)="open()" />

            <app-advanced-search-rest
                [items]="searchItems()"
                [filter]="flatFilter()"
                [modes]="modes()"
                [title]="title()"
                (search)="onSearch($event)"
                (clear)="onClear()" />
        }
    `,
})
export class GpoTableSearchComponent {
    readonly columns = input.required<readonly GpoTableColumn[]>();
    readonly isShowButton = input(true);
    readonly title = input('Расширенный поиск');
    readonly filterChange = output<string | undefined>();

    private readonly _search = viewChild(RestAdvancedSearchComponent);
    protected readonly flatFilter = signal<Record<string, unknown>>({});
    protected readonly modes = signal<Record<string, unknown>>({});

    protected readonly searchItems = computed(() => buildGpoTableSearchItems(this.columns()));
    private readonly searchRules = computed(() => buildSearchFormRules(this.searchItems()));

    protected open(): void {
        this._search()?.open();
    }

    protected onSearch(event: SearchEvent<Record<string, unknown>>): void {
        this.flatFilter.set(event.filter);
        this.modes.set(event.modes);

        const builder = typedGridify<Record<string, unknown>>();
        applySearchForm(builder, event.filter, this.searchRules(), { modes: event.modes });
        this.filterChange.emit(builder.build().filter);
    }

    protected onClear(): void {
        this.flatFilter.set({});
        this.modes.set({});
        this.filterChange.emit(undefined);
    }
}
```

Маппинг `GpoTableSearchField` → `SearchItem`:

| `kind` | Дескриптор `advanced-search-rest` |
|---|---|
| `contains` | `SearchItemContains` |
| `equals` | `SearchItem` |
| `word` | `SearchItemWordSearch` |
| `number` | `SearchItemNumber` |
| `numberCondition` | `SearchItemNumberCondition` |
| `date` | `SearchItemDate` |
| `dateRange` | `SearchItemDateRange` |
| `select` | `SearchItemSelect` + справочник |
| `multipleSelect` | `SearchItemMultipleSelect` + справочник |

```ts
/** Собрать items для app-advanced-search-rest из полей таблицы */
export function buildGpoTableSearchItems(columns: readonly GpoTableColumn[]): Record<string, SearchItem> {
    const items: Record<string, SearchItem> = {};
    for (const field of buildGpoTableSearchFields(columns)) {
        items[field.key] = createSearchItem(field);
    }
    return items;
}

function createSearchItem(field: GpoTableSearchField): SearchItem {
    const item = createByKind(field);
    if (field.field !== field.key) {
        item.setField(field.field);
    }
    applyDictionary(item, field.dictionary);
    return item;
}

function createByKind(field: GpoTableSearchField): SearchItem {
    switch (field.kind) {
        case 'contains':
            return new SearchItemContains(field.title);
        case 'equals':
            return new SearchItem(field.title);
        case 'word':
            return new SearchItemWordSearch(field.title);
        case 'number':
            return new SearchItemNumber(field.title);
        case 'numberCondition':
            return new SearchItemNumberCondition(field.title);
        case 'date':
            return new SearchItemDate(field.title);
        case 'dateRange':
            return new SearchItemDateRange(field.title);
        case 'select':
            return new SearchItemSelect(field.title);
        case 'multipleSelect':
            return new SearchItemMultipleSelect(field.title);
        default:
            return new SearchItem(field.title);
    }
}
```

`createByKind` — обычный `switch` по `field.kind`; `applyDictionary` умеет и массив, и провайдер:

```ts
function applyDictionary(item: SearchItem, dictionary?: GpoTableSearchDictionary): void {
    if (!dictionary || !(item instanceof SearchItemSelect)) {
        return;
    }
    if (typeof dictionary === 'function') {
        item.setDictionaryProvider(() => dictionary() as unknown[]);
    } else {
        item.setDictionary(dictionary as unknown[]);
    }
}
```

\* `as unknown[]` здесь — только на границе с легаси-типом `SearchItem.dictionary: any[]`; в core-типах
`any` нет. В проекте можно заменить на `SearchItemSelect`-типизированный адаптер.

#### Что остаётся за рамками

- воронки/фильтры в шапке колонок — нет; поиск живёт в drawer'е;
- сохранение состояния поиска (localStorage/deep-links) — отдельно, через тот же стек;
- чипы `filter-display` — не в v1; при необходимости интеграция отдаст `flatFilter` наружу;
- полностью свой вид поля — через расширение маппинга `kind` в интеграции, не в ядре.

#### Почему поиск не внутри ядра

`advanced-search-rest` — проект-специфичный стек (Reactive Forms, `SearchItem`, `applySearchForm`).
Если положить его в ядро, папка перестанет быть переносимой. Поэтому:

- ядро строит **описания полей** (`GpoTableSearchField`) — переносимо;
- готовая интеграция с drawer'ом — рядом, в `gpo-table-integrations/advanced-search/`;
- дома можно разрабатывать ядро и `buildGpoTableSearchFields`, а UI поиска подключить позже
  или собрать простой свой.

Если хочется совсем один тег, в `gpo-table-integrations` можно сделать тонкую обёртку
`gpo-table-with-search`: она складывает `gpo-table` + `app-gpo-table-search`
и проксирует входы/выходы. В ядро это не тащим.

---

## 4. Внедрение

### 4.1. Минимальный пример

```ts
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ItemsApiService } from '@swagger/api';
import { GpoTableColumn, GpoTableComponent } from 'src/app/lib/gpo-table';
import { swaggerGridifyDataSource } from 'src/app/lib/gpo-table/adapters';

interface ItemRow {
    id: number;
    code: string;
    name: string;
    count: number;
    createdAt: string;
}

@Component({
    selector: 'app-items',
    standalone: true,
    imports: [GpoTableComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <gpo-table
            [dataSource]="dataSource"
            [columns]="columns"
            [filter]="filter()" />
    `,
})
export class ItemsComponent {
    // Имена сервиса и метода — из вашего сгенерированного @swagger/api
    private readonly _itemsApi = inject(ItemsApiService);

    /** Готовая Gridify-строка; пустая — без фильтра */
    readonly filter = signal<string | undefined>(undefined);

    readonly dataSource = swaggerGridifyDataSource<ItemRow>((query) =>
        this._itemsApi.itemsGetItemsQry(query.page, query.pageSize, query.orderBy, query.filter),
    );

    readonly columns: GpoTableColumn<keyof ItemRow>[] = [
        { title: 'Код', field: 'code', width: '120px', isSortable: true },
        { title: 'Наименование', field: 'name' },
        { title: 'Количество', field: 'count', type: 'number', width: '120px', isSortable: true },
        { title: 'Дата создания', field: 'createdAt', type: 'date', width: '140px', isSortable: true },
    ];
}
```

Всё: страница не грузит данные, не хранит `page/rows/total/loading`, не обрабатывает пагинацию
и сортировку. `dataSource` — обычное поле класса, создаётся один раз.

### 4.2. Шаблонная колонка

```ts
readonly columns: GpoTableColumn<keyof ItemRow>[] = [
    { title: 'Код', field: 'code', width: '120px', isSortable: true },
    { title: 'Наименование', field: 'name' },
    { title: '', field: 'id', type: 'template', width: '120px', align: 'center' },
];
```

```html
<gpo-table [dataSource]="dataSource" [columns]="columns">
    <ng-template gpoTableCell="id" let-row>
        <button nz-button nzSize="small" (click)="$event.stopPropagation(); edit(row)">Изменить</button>
    </ng-template>
</gpo-table>
```

Для колонки действий используется реальное поле строки (`id`), но ячейка рисуется шаблоном.
Если нужны две шаблонные колонки на одно поле — берётся любое другое существующее поле;
искусственные ключи не требуются. Компонент страницы подключает `GpoTableCellDirective`
и `NzButtonModule` (или те модули, чьи контролы используются в шаблоне ячейки). Обработчик `edit` принимает
`Record<string, unknown>` и приводит запись к DTO страницы — как в §3.9.

### 4.3. Расширенный поиск и базовый фильтр

**Штатный путь** — `app-gpo-table-search` в header-слоте; поля строятся из колонок,
настраиваются только исключения и справочники:

```html
<gpo-table
    [dataSource]="dataSource"
    [columns]="columns"
    [filter]="baseFilter()"
    [searchFilter]="searchFilter()">

    <app-gpo-table-search
        gpoTableHeader
        [columns]="columns"
        [isShowButton]="canUseAdvancedSearch()"
        (filterChange)="searchFilter.set($event)" />
</gpo-table>
```

```ts
readonly columns: GpoTableColumn[] = [
    { title: 'ID', field: 'id', type: 'number' },                 // id не ищется по умолчанию
    { title: 'Комментарий', field: 'comment', search: false },     // убрать из поиска
    {
        title: 'Организация',
        field: 'orgCode',
        search: { kind: 'select', dictionary: () => this.organizationOptions() },
    },
];
```

**Без поиска** — просто не добавляйте `app-gpo-table-search`; `searchFilter` не нужен:

```html
<gpo-table [dataSource]="dataSource" [columns]="columns" />
```

По умолчанию получается таблица с шапкой, строками, пагинацией и «Всего записей». Кнопки
поиска, drawer'а и полей поиска нет; `column.search` в этом режиме игнорируется. Если нужны
постоянные условия — добавьте `[filter]="baseFilter()"`, если нет — не добавляйте.

`baseFilter` — постоянные условия страницы (отчётный режим, филиал и т.п.),
`searchFilter` — результат расширенного поиска. Таблица склеивает их через
`combineGridifyFilters`: `(base),(search)`, сбрасывает страницу и делает один запрос.

**Если нужен свой внешний фильтр** (дерево, deep-link, нестандартный контрол), страница
собирает Gridify-строку сама и передаёт в `[filter]`:

```ts
import { computed } from '@angular/core';
import { typedGridify } from 'src/app/lib/typed-gridify';

readonly baseFilter = computed(() =>
    typedGridify<ItemRow>()
        .eq('code', this.selectedCode())
        .build()
        .filter,
);
```

```html
<gpo-table
    [dataSource]="dataSource"
    [columns]="columns"
    [filter]="baseFilter()"
    [searchFilter]="searchFilter()" />
```

При смене `filter` или `searchFilter` таблица сама сбрасывает страницу на первую и делает один
запрос строк (и один запрос агрегатов, если в `dataSource` есть `getAggregates`). Дебаунс —
задача формы поиска, а не таблицы.

### 4.4. Агрегаты

Агрегаты опциональны: не передали второй метод в `swaggerGridifyDataSource` — второго запроса нет.

```ts
readonly dataSource = swaggerGridifyDataSource<BuyQry, BuyAggregatesResponse>(
    (query) => this._buyApi.buyGetBuyQry(query.page, query.pageSize, query.orderBy, query.filter),
    (query) => this._buyApi.buyGetBuyAggregates(query.page, query.pageSize, query.orderBy, query.filter),
);
```

```html
<gpo-table
    [dataSource]="dataSource"
    [columns]="columns"
    [filter]="filter()"
    [aggregatesTemplate]="aggregatesTpl" />

<ng-template #aggregatesTpl let-aggregates let-isLoading="isLoading" let-error="error">
    @if (isLoading) {
        <nz-spin nzSimple nzSize="small"></nz-spin>
    } @else if (error) {
        <span>Не удалось загрузить итоги</span>
    } @else {
        <span>Всего: <strong>{{ (aggregates?.count ?? 0) | number: '1.0-0' }}</strong></span>
        <span>Сумма: <strong>{{ (aggregates?.amount ?? 0) | number: '1.2-2' }}</strong></span>
    }
</ng-template>
```

Контракт агрегатов задаёт бэкенд; адаптер передаёт в `/aggregates` только `filter`
с `Page=1&PageSize=1`. Тип агрегатов задаётся вторым generic-параметром
`swaggerGridifyDataSource<TRow, TAggregates>`; страница подключает `DecimalPipe`
и `NzSpinModule` для примера выше.

### 4.5. Постобработка строк

Если кроме вызова swagger нужна постобработка (подписи вместо кодов, вычисляемые поля),
`dataSource` реализуется вручную — это тот же интерфейс, что возвращает адаптер:

```ts
import { firstValueFrom } from 'rxjs';
import { GpoTableDataSource } from 'src/app/lib/gpo-table';
import { toGridifyOrderBy } from 'src/app/lib/gpo-table/adapters';

readonly dataSource: GpoTableDataSource<ItemRow> = {
    getPage: async (query) => {
        const response = await firstValueFrom(
            this._itemsApi.itemsGetItemsQry(
                query.page,
                query.pageSize,
                toGridifyOrderBy(query.sort),
                query.filter,
            ),
        );
        return { rows: this.prepareRows(response.data), total: response.count };
    },
};
```

```html
<gpo-table [dataSource]="dataSource" [columns]="columns" [filter]="filter()" />
```

`dataSource` должен быть стабильным полем класса, а не создаваться в шаблоне вызовом метода:
иначе эффект контейнера будет переподключать источник на каждом изменении.

### 4.6. Обновление после изменений

```ts
private readonly table = viewChild.required(GpoTableComponent);

async onSaved(): Promise<void> {
    await this.table().reload();
}
```

`reload()` обновляет и строки, и агрегаты. Если изменился только фильтр — достаточно изменить
сигнал `filter`, таблица перезагрузится сама.

---

## 5. Соответствие старому API и миграция

### 5.1. Таблица соответствий

| `lib-gpo-table` / `gpo-lib` | `gpo-table` |
|---|---|
| `[dataTable]` | нет; строки грузит сама таблица |
| `[loading]` | нет; `isLoading` внутри |
| `[totalCount]`, `[pageIndex]`, `[pageSize]` | нет; состояние внутри |
| `[columns]` + `ColumnFiltered` | `[columns]` + `GpoTableColumn` |
| `[titleTableName]` + настройки колонок | `storageKey` — сохранение только ширин; видимость/порядок не в v1 |
| `(pageIndexChange)`, `(pageSizeChange)` | `(pageChange)`, `(pageSizeChange)`, `(sortChange)` — опционально для аналитики |
| `(sortColumnChange)` | `(sortChange)`; таблица уже применила сортировку |
| `(clickedTd)` | `(rowClick)` |
| `(dblclickRow)` | `(rowDblClick)` |
| `(clickActiveCell)` | шаблонная колонка |
| `[editAccess]`, `[actionsForm]` | сервис `GPO_TABLE_ACTIONS`: `isEdit`, `onEdit`, `onRemove` |
| `[customButtons]`, `[isShowSettings]` | контент над таблицей: атрибут `gpoTableHeader` |
| `[isShowActions]` | колонка действий показывается, если сервис действий провайдится и `isEdit: true` |
| `[title]`, `[legend]` | контент над/под таблицей: `gpoTableHeader` / `gpoTableFooter` |
| `[footerTemplate]` | `aggregatesTemplate` или `gpoTableFooter` (при `[isShowFooter]="false"`) |
| `[customFirstThCol]`, `[customTdBtn]`, `[statusTd]` | шаблонная колонка |
| `[conditions]`, `[conditionsNumber]`, `[specialColumn]` | `column.search` (auto по типу) + `app-gpo-table-search`; воронок в шапке нет |
| `[useVirtualScroll]` | нет в v1 |
| `[bordered]`, `[size]`, `[ellipsis]` | CSS/LESS страницы; ellipsis — в стилях таблицы |
| `[scrollX]`, `[widthAdd]` | `[scrollWidth]` |
| `[heightAdd]` | `[bottomOffset]`; высота всегда считается до низа окна |
| `[selectorStart]`, `[selectorEnd]`, `[parentNode]` | нет; хрупкие DOM-селекторы не нужны |
| `[userFontSize]` | CSS страницы |
| `[unicumField]` | `[rowKey]` |
| `[formatDate]` | `column.dateFormat` (по умолчанию `dd.MM.yyyy`; в `gpo-lib` — `dd.MM.yyyy, H:mm`) |
| `[selectDisplayMode]`, `[cardTemplate]` | нет |
| `[addingExtendedClass]`, `[addingExtendedRowClass]` | `column.cssClass` + CSS страницы |

Колонки:

| `ColumnFiltered` | `GpoTableColumn` |
|---|---|
| `name` | `title` |
| `columnKey` | `field` |
| `visible` | `isVisible` (по умолчанию `true`, а не `false`) |
| `width` | `width` |
| `sort` | `isSortable` |
| `type` | `type` (см. таблицу ниже) |
| `orientation` (прилипание колонки) | нет в v1 |
| `searchValue`, `condition`, `active`, `select`, `typeFilter`, `selection`, `inwhere` | нет; фильтр приходит строкой снаружи |

| `ETypeColumn` | `GpoTableColumn.type` |
|---|---|
| `string`, `select`, `textAria`, `year`, `week`, `monthAndYear` | `text` |
| `number`, `observableNumber` | `number` |
| `date` | `date` |
| `enum`, `boolean`, `multiSelect`, `selectTree`, `observableSelect`, `observableBoolean`, `status`, `specialColumn`, `template` | `template` |

Фильтры колонок (`ETypeColumnFilter`) переходят в `column.search`:
`text`/`string` → `contains`/`word`/`equals`, `number` → `numberCondition`, `date` → `dateRange`,
`select` → `select`/`multipleSelect` + справочник, `specialColumn` → своя настройка или `search: false`.

### 5.2. Что сохраняем и что убираем

**Сохраняем:**

- пагинацию: номер, размер, быстрый переход;
- сортировку по колонке (asc → desc → без сортировки);
- ширины колонок с сохранением в `localStorage` по `storageKey`;
- состояния загрузки, пустоты и ошибки;
- форматирование чисел и дат проектными средствами (`LOCALE_ID`);
- шаблоны ячеек — единственный способ сделать ссылку, кнопку, статус, чекбокс и т.п.;
- произвольный контент над и под таблицей через `ng-content` (заголовок, кнопки, легенда, свои итоги);
- опциональный расширенный поиск: поля строятся из колонок, настраиваются только исключения
  и справочники;
- опциональные агрегаты с тем же фильтром, что у строк.

**Убираем из таблицы:**

- CRUD-модалки и формы — компоненты страницы; встроенная колонка действий только вызывает сервис;
- воронки/фильтры в шапке колонок (расширенный поиск — отдельный drawer);
- настройки видимости/порядка колонок и `localStorage` (ширины колонок уже сохраняются);
- карточки, переключатель режимов, дерево;
- виртуальный скролл;
- подсветку латинских символов;
- хрупкие DOM-селекторы (`selectorStart`/`selectorEnd`) и `setTimeout` для высоты;
- встроенные «спецколонки» и колонка действий (заменяются шаблонными ячейками);
- мёртвые входы и поля состояния.

**Возможные расширения после пилота (не v1):**

- `boolean`, `enum`, `status` как отдельные типы, если шаблон повторится 3+ раза;
- воронка/фильтр в шапке колонки (поверх расширенного поиска);
- видимость и порядок колонок с сохранением в `localStorage`;
- выделение строк и массовые действия;
- виртуальный скролл для больших страниц;
- встроенный экспорт/печать.

### 5.3. Порядок миграции

1. **Каркас новой таблицы** (`gpo-table/*`), юнит-тесты состояния и источника, без изменения
   существующих страниц.
2. **Пилот на одной простой REST-странице** без дерева и специфических действий
   (например, список asot или buy). Критерий: страница стала короче, поведение совпадает.
3. **Пилот на странице с шаблонными ячейками и агрегатами** (buy или отчёт).
4. **Подключение auto-search на пилоте**: `column.search` только для исключений/справочников,
   `app-gpo-table-search` в header-слоте, флаг `isShowButton`, склейка `searchFilter`.
5. **Миграция остальных реестров по одной странице**; `gpo-lib` остаётся для дерева,
   карточек и ещё не переведённых страниц.
6. **Чистка**: когда `lib-gpo-table` не используется, удалить его вместе с
   `GpoLibService`, `ColumnFiltered`, настройками, подсветкой и `sortList`.

Правило: одна страница — один коммит; поведение не меняется, кроме осознанно убранных
возможностей (о них — в описании коммита/задаче).

### 5.4. Риски и их снятие

| Риск | Снятие |
|---|---|
| Проекция компонентов в `nz-table` (`thead`/`tbody`/`tr`) поведёт себя иначе, чем инлайн-разметка | Первый прототип — до пилота: шапка + 2 строки + сортировка. При проблеме — нативная `<table>` с классами `ant-table` и теми же компонентами |
| Экспорт/печать завязаны на `ColumnFiltered` (`ExportTable`, `print-table.service`) | В v1 экспорт не входит; на мигрируемых страницах либо оставить старую таблицу до адаптации экспорта, либо описать колонки для `ExportTable` отдельно |
| Пользователи привыкли к настройкам колонок и `localStorage` | Ширины сохраняются по `storageKey`; видимость и порядок колонок — отдельным шагом |
| Контент над/под таблицей остаётся у страницы | Это осознанно: `gpoTableHeader`/`gpoTableFooter` дают место для любых кнопок и текстов, но таблица не обрастает их логикой |
| `filter` приходит слишком часто | Дебаунс/применение по кнопке — в форме поиска; таблица делает запрос на каждое новое значение |
| Автопоиск тянет лишние/технические поля | `id` и `template` исключены по умолчанию; `search: false`; явный `search.kind` включает поле обратно |
| Поиск ломает базовый фильтр с OR-группами | `combineGridifyFilters` оборачивает каждую часть в скобки: `(base),(search)`; проверить тестом |
| Гонки запросов | Снимок `query` в `GpoTableStateService`; поздний ответ отбрасывается |
| Ошибка одного `track`-ключа ломает строки | `rowKey` по умолчанию `id`; при отсутствии ключа используется индекс |
| Скрытая зависимость от `BaseTable` | Новая таблица не импортирует `BaseTable`, `GridifySearchTable`, `GridifyRepository`, `ColumnFiltered`, `Utils` и `gpo-lib` — только Angular, ng-zorro и свои файлы |

### 5.5. Критерии готовности

- На пилотной странице нет `lib-gpo-table`, `BaseTable`, `ColumnFiltered`, `GpoLibService`.
- Страница передаёт `dataSource`, `columns` и (при необходимости) `filter`/`searchFilter` — не более.
- На одну загрузку страницы уходит **один** запрос строк; агрегаты — только если в `dataSource`
  есть `getAggregates`.
- Пагинация, сортировка, пусто, загрузка и ошибка работают без ручных обработчиков страницы.
- Поля расширенного поиска строятся из колонок; исключения — только `search: false`,
  справочники — `search.dictionary`; кнопка управляется флагом `isShowButton`.
- Базовый `filter` и `searchFilter` склеиваются через AND, смена любого сбрасывает страницу.
- Состояние таблицы — только сигналы; в компонентах нет `subscribe`, `BehaviorSubject`
  и `detectChanges`.
- `npx tsc --noEmit -p tsconfig.app.json` и `ng build` проходят; шаблоны проверены сборкой.

---

## 6. Решения и альтернативы

| Вопрос | Решение | Почему |
|---|---|---|
| Кто грузит данные | Контейнер + `GpoTableStateService` | «Внедрение в несколько строк»: страница не должна повторять пагинацию/сортировку/загрузку |
| Транспорт | Gridify REST через сгенерированный swagger-клиент | Это целевой стек проекта; GraphQL/QB-таблицы остаются на старых моделях до отдельной миграции |
| Как передать данные | `dataSource` из swagger-методов | Типы и методы уже сгенерированы; URL-строки в таблице не нужны. `swaggerGridifyDataSource` убирает повторяющийся маппинг ответа, своя реализация — для постобработки |
| Где живёт фильтр | Базовый `filter` — снаружи; поиск — `searchFilter` из интеграции | Таблица не знает поля формы; склеивает две Gridify-строки через AND |
| Поля расширенного поиска | Автоматически из колонок | Не перечислять все поля; исключения (`search: false`) и справочники (`search.dictionary`) — точечно |
| Где живёт drawer поиска | В `gpo-table-integrations/advanced-search` | Ядро остаётся переносимым; `advanced-search-rest` — проектный стек |
| Модель колонки | Объект, 4 типа | Читается без конструктора и позиционных аргументов; сложное — шаблоном |
| Шаблоны ячеек | Контент-директива `gpoTableCell` | Не нужно ждать `viewChild` и пересобирать колонки после инициализации |
| Разбиение | `head` / `body` / `row` / `foot` | Маленькие OnPush-компоненты; строку можно менять, не трогая таблицу |
| Состояние | `signal`/`computed`, сервис на компонент | Нет утечки между таблицами; нет RxJS-подписок и ручной перерисовки |
| Высота | `max-height` от `GpoTableHeightService` | Таблица прижимается к низу окна, но при малом числе строк не растягивается; без DOM-селекторов и `setTimeout` |
| Ширины колонок | `GpoTableColumnResizeDirective` + `GpoTableColumnWidthService` | Resize остаётся в шапке, сохранение — отдельным сервисом; ключ `storageKey` не даёт таблицам перетирать ширины друг друга |
| Действия строки | Сервис по токену `GPO_TABLE_ACTIONS` | Не плодить входы таблицы; новые флаги и методы добавляются в сервис страницы |
| Фильтры колонок | Воронки в шапке — не в v1; расширенный поиск — отдельная интеграция | Самый тяжёлый кусок `gpo-lib` — воронки; поиск в drawer'е проще и не ломает шапку |
| Поля расширенного поиска | Автоматически из колонок + `column.search` | Не перечислять все поля: только исключения (`search: false`) и справочники |
| Карточки, настройки, CRUD | Не в v1 | Каждая функция удваивает разметку и состояние; для них есть отдельные компоненты/страницы |
| `BaseTable`/`GridifySearchTable` | Не используем | Они тянут легаси-модель и union фильтров; новая таблица принимает плоский `GpoTableQuery` |
| Как переносить между проектами | Самодостаточная папка + адаптеры, копирование | Временный режим: npm-пакет или submodule — лишняя инфраструктура. Когда механизм готов, папка целиком переносится сюда |
| Кастомизация | header/footer — `ng-content`, ячейки — `ng-template` | Над/под таблицей проекция безопасна; внутри `<table>` — только шаблоны, иначе ломается раскладка |

**Почему не сделать таблицу полностью dumb, а загрузку оставить странице?** Тогда каждая
страница снова пишет обработчики пагинации, сортировки, загрузки и гонок — ровно то, от чего
уходим. Контейнер остаётся «умным», а `head`/`body`/`row`/`foot` — глупыми и переиспользуемыми.

---

## 7. Переносимость: работа дома и перенос обратно

Цель: папка таблицы — самостоятельный мини-проект, который копируется между этим репозиторием
и пустым Angular-проектом. Пока таблица не готова, дом — полигон; здесь — рабочая интеграция.
Когда механизм готов, папка целиком переносится сюда.

### 7.1. Границы переносимой папки

- внутри папки — только относительные импорты;
- разрешено: `@angular/*`, `ng-zorro-antd`, `rxjs` (только в адаптерах);
- запрещено: `src/app/**`, `gpo-lib`, `@swagger/api`, `Utils`, `typed-gridify`, проектные
  типы, алиасы и `environment`;
- адаптеры принимают функции/структурные типы снаружи, но не импортируют их;
- шаблоны и стили — инлайн, без `.html`/`.less` и проектных тем;
- `adapters/static-*` не входят в публичный API ядра; демо — внешний потребитель
  в `src/app/demo/gpo-table-demo`, в переносимую папку не входит.

Что специально развязано для переносимости:

| В рабочем проекте было бы | В переносимой таблице | Зачем |
|---|---|---|
| `Utils.getTextError` | локальный `getErrorMessage` | нет проектной утилиты |
| жёсткая локаль `'ru'` | `LOCALE_ID` приложения | дома локаль может быть `en-US` |
| URL + `HttpClient` | `GpoTableDataSource` | транспорт снаружи |
| `@swagger/api` в таблице | функции в `swaggerGridifyDataSource` | типы остаются на странице |
| `advanced-search-rest` в ядре | `buildGpoTableSearchFields` в ядре + `gpo-table-integrations/advanced-search` снаружи | ядро переносимо, drawer — проектный |
| `gpo-lib`, `BaseTable` | свои типы и состояние | нет легаси-зависимостей |
| LESS | инлайн-CSS | пустой проект может быть на CSS |

### 7.2. Дом: пустой проект

```bash
ng new gpo-table-lab --standalone --style=css --strict
cd gpo-table-lab
npm i ng-zorro-antd@18 @angular/cdk@18
```

Подключить стили ng-zorro (`angular.json` → `styles` или `src/styles.css`):

```css
@import 'ng-zorro-antd/ng-zorro-antd.min.css';
```

Скопировать папку `src/app/lib/gpo-table` из рабочего проекта в `src/app/gpo-table`.
Создать демо-страницу на статическом источнике:

```ts
import { GpoTableColumn, GpoTableComponent } from './gpo-table';
import { staticGridifyDataSource } from './gpo-table/adapters';

interface DemoRow {
    id: number;
    name: string;
    count: number;
    createdAt: string;
}

const ROWS: DemoRow[] = [
    { id: 1, name: 'Первая строка', count: 12, createdAt: '2026-01-15' },
    { id: 2, name: 'Вторая строка', count: 7, createdAt: '2026-02-20' },
];

@Component({
    selector: 'app-demo',
    standalone: true,
    imports: [GpoTableComponent],
    template: `<gpo-table [dataSource]="dataSource" [columns]="columns" />`,
})
export class DemoComponent {
    readonly dataSource = staticGridifyDataSource(ROWS);
    readonly columns: GpoTableColumn<keyof DemoRow>[] = [
        { title: 'Наименование', field: 'name', isSortable: true },
        { title: 'Количество', field: 'count', type: 'number' },
        { title: 'Дата', field: 'createdAt', type: 'date' },
    ];
}
```

Версия Angular дома — **18**, как в рабочем проекте: совпадают сигнальные входы/запросы,
`allowSignalWrites` и версия ng-zorro. Если дома окажется Angular 19+:

- убрать `allowSignalWrites` из эффектов (в 19+ запись в эффектах разрешена по умолчанию);
- проверить версию ng-zorro и её peer-зависимости;
- остальное (inline-шаблоны, `@if/@for`, `input/output`) переносится без изменений.

Ни `gridify-client`, ни бэкенд дома не нужны: для UI достаточно `staticGridifyDataSource`.

### 7.3. Что разрабатывать дома

- компоненты, шаблоны, стили, состояния;
- сортировку, пагинацию, пусто/загрузку/ошибку;
- шаблонные ячейки и колонки `text/number/date/template`;
- `buildGpoTableSearchFields` (поля поиска из колонок) и его тесты;
- unit-тесты `GpoTableStateService` (гоночный сценарий, сброс страницы, пустая страница);
- адаптер `staticGridifyDataSource` и демо-страницу.

Рабочие адаптеры (`swagger`), `gpo-table-integrations/advanced-search`, данные и страницы сюда не тащить:
они живут на стороне проекта. Для UI поиска дома достаточно простого своего контрола поверх
`buildGpoTableSearchFields`.

### 7.4. Как перенести обратно

1. Скопировать папку `gpo-table` в `src/client/ias/src/app/lib/gpo-table` (заменить).
2. Внутри папки импорты относительные — править ничего не нужно.
3. На странице оставить только рабочий `dataSource` (swagger-адаптер), `columns` и `filter`.
4. Проверить: `npx tsc --noEmit -p tsconfig.app.json`, `ng build`, тесты.
5. Коммит `[feat]` или `[refactor]`; изменение контракта таблицы — отдельным коммитом
   и с обновлением затронутых страниц.

### 7.5. Синхронизация и версии

- Дом — временный источник истины для папки таблицы.
- В папке держать `README.md` (как подключить) и `CHANGELOG.md` + версию `0.x`.
- Копировать папку целиком, а не отдельные файлы: иначе разъедутся типы и адаптеры.
- Рабочие и домашние правки не смешивать: `adapters/` разделены, демо вынесено
  в `src/app/demo/gpo-table-demo`.
- Если нужна строгая версионность — отдельный git-репозиторий с этой папкой и demo-приложением;
  сюда переносить копированием или `git subtree` (submodule для временного решения не нужен).
- Когда механизм готов: заморозить домашнюю версию, перенести папку, удалить демо-страницу
  из `src/app/demo`, если она не нужна в рабочем репозитории.
  и `adapters/static-*`, если они не нужны в рабочем репозитории.

### 7.6. Чек-лист перед переносом

- [ ] в папке `gpo-table` нет импортов из `src/app`, `gpo-lib`, `@swagger/api`, `Utils`,
      `typed-gridify` и `gpo-table-integrations`;
- [ ] нет `any`, `as any`, `@ts-ignore` и проектных алиасов;
- [ ] нет `.less`/`.html`-файлов и ссылок на проектные темы;
- [ ] `buildGpoTableSearchFields` покрыт тестами (id/template/исключения/справочники);
- [ ] пустой проект собирается (`ng build`);
- [ ] рабочий проект собирается (`ng build`) и проходит `tsc`;
- [ ] демо-страница (`src/app/demo`) и `static`-адаптер не попали в публичный API ядра;
- [ ] проверены пусто/загрузка/ошибка, сортировка, пагинация, шаблонная ячейка, агрегаты.

---

## 8. Открытые вопросы

1. **Размер страницы по умолчанию.** В проекте `BaseTable` использует 150, в примерах выше — 150.
   Если для новых REST-реестров удобнее 50 — поменять одно значение в `GpoTableStateService`.
2. **Нужны ли строки-«итоги» внутри таблицы** (не в футере), например для группировок? В v1 —
   нет; при необходимости добавить тип строки или отдельный шаблон.
3. **Нужен ли экспорт в v1.** Если да — определить контракт: страница передаёт колонки в
   `ExportTable` отдельно, таблица в это не вмешивается.
4. **Нужно ли сохранять размер страницы** между сессиями. Сейчас нет; можно вернуть на уровне
   страницы (`localStorage` + вход `pageSize`).


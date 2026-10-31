# advanced-search-rest

Стек расширенного поиска для REST-таблиц на Gridify. Описание полей задаётся
один раз — из него выводится всё остальное: drawer с формой, правила перевода
фильтра в Gridify, подписи чипов filter-display, тип формы (TypeScript),
deep-links, форматирование значений.

Стек транспорт-агностичен: плоский фильтр с суффиксами (Hasura-стиль) для
gql-страниц является готовым `where`, для REST переводится в Gridify по
декларативным правилам.

Строковые условия помечаются `/i` — текст ищется без учёта регистра
(числа и даты-объекты `Date` флаг не получают). Пробелы в значениях
экранируются (`\ `): парсер Gridify съедает ведущий пробел значения.

## Состав

| Файл | Роль |
|---|---|
| `index.ts` | Public API стека — импорт одной строкой: `from 'src/app/components/advanced-search-rest'` |
| `search-item.ts` | Дескрипторы полей. Каждый класс владеет знанием о представлении поля: сериализация в фильтр (`toFilter`), обратная сборка контрола (`patchControl`), структура контрола (`createControl`), правило Gridify (`defaultRule`), ключи фильтра (`filterKeys`). Здесь же `SearchFormOf` — вывод типа плоского фильтра из описания полей |
| `rest-advanced-search.component.ts` | Drawer (форма + «Закрыть/Очистить/Поиск»). Владеет Reactive Form и синхронизацией форма ↔ фильтр |
| `search-page.base.ts` | Каркас страницы: drawer, пульсация кнопки, персист фильтра в localStorage, клоны export/print, deep-links, форматтер чипов, режимы поиска |
| `search-form.ts` | `applySearchForm` — перевод плоского фильтра в Gridify по правилам |
| `search-rules.ts` | `buildSearchFormRules` — правила из дескрипторов (дефолт + `field` + `rule`) |
| `search-display-names.ts` | Подписи filter-display из дескрипторов; `treeNodeDisplayName` — подпись узла дерева по ключу |

Таблица — `GridifySearchTable` (`src/app/lib/typed-gridify/gridify-search-table.ts`):
колонки, сортировка по умолчанию, `generateGridifyRequest` собирается сам.
HTTP — хелперы `gridifyGet` / `gridifyGetBlob` (`src/app/lib/typed-gridify/gridify-http.ts`).

## Дескрипторы полей

Каждая строка конфига описывает поле целиком:

```ts
mtrGroup: new SearchItemMultipleHierarchySelect('Наименование группы продукции', { nullValue: '0', exact: true })
    .setDictionaryProvider(memoDictionary(() => d().directoryMtrName,
        (items) => toCodeDictionary(items, 'code', 'name')))
    .setField('mtrGroupCode')
    .setQueryParam('mtrGroupCodes', { expand: (raw) => ... }),
```

Типы: `SearchItem` (строка), `SearchItemContains`, `SearchItemWordSearch`
(поиск по словам, режим FULL/PARTIAL из `searchModes` по ключу поля,
по умолчанию PARTIAL), `SearchItemHierarchyCode` (иерархический код),
`SearchItemNumber`, `SearchItemNumberCondition`, `SearchItemDate`,
`SearchItemDateRange`, `SearchItemDateYearRange`, `SearchItemTimeRange`,
`SearchItemSelect`, `SearchItemSelectTree`, `SearchItemMultipleSelect`
(условие `_in` по умолчанию), `SearchItemMultipleHierarchySelect`
(multiple-select + иерархия), `SearchItemMultipleTreeSelect`,
`SearchItemComponent` (модалка выбора).

Сеттеры:

- `setField(name)` — имя колонки Gridify-проекции, если отличается от ключа;
- `setRule(rule)` — особое правило: `wordSearch`, `hierarchy`, `in` +
  `expandValue`, `custom`. Повторяющиеся семантики фиксируются подклассами
  (`SearchItemWordSearch`, `SearchItemHierarchyCode`,
  `SearchItemMultipleHierarchySelect`) — в конфиге правило не повторяется;
- `setDictionary` / `setDictionaryProvider` — справочник (для провайдера
  оборачивать в `memoDictionary` — иначе пересоздание тысяч nz-option при
  каждом открытии drawer'а); словари «код + наименование» — через
  `toCodeDictionary`: их опции рисуются с выделенным жирным кодом;
- `setVisible(false)` — поле управляется снаружи (отчётные контролы,
  deep-links): не рисуется в drawer'е и не читается из формы;
- `setQueryParam(name | имена, { part?, type?, expand? })` — привязка
  deep-link'а (см. ниже); `expand(raw, params)` раскрывает значение по
  справочникам/деревьям конфига и читает параметры-модификаторы;
- `setDisplayValue(fn)` — форматирование значения чипа, если подписи
  справочника недостаточно; для деревьев — `treeNodeDisplayName(nodes, value,
  { key?, title? })` (поиск узла по ключу, включая вложенные);
- `setBeforeList(list)` — режим перед полем («По частичному / По полному»);
  значение уходит в `searchModes` таблицы, не в фильтр;
- `setCondition(cond)` — редкое условие (`_starts_with`, `_not_in`);
  подкласс-специфичные сеттеры вызывать ДО него;
- `setInitialDisabled(true)`, `watchChange()` — блокировка и кросс-правила страницы.

## Чеклист новой таблицы

1. **Конфиг полей** — `x-search-config.ts` c методом `buildItems()`:
   дескрипторы с лейблами, справочниками, правилами и deep-link'ами.
2. **Таблица** — `XTable extends GridifySearchTable<XForm, XRow>`: колонки,
   `defaultOrder`; при необходимости переопределить `searchFormOptions`
   (например режим И/Или) и `configureRequest` (постоянные условия вне формы).
   Агрегаты: в конструктор передаётся функция загрузки (`fetchAggregates`),
   `updateAggregates()` зовёт её один раз на `applyFilter` и раскладывает
   ответ методом `applyAggregates(res)` по счётчикам таблицы.
3. **Форма** — `export type XForm = SearchFormOf<ReturnType<XSearchConfig['buildItems']>>`
   + ручное расширение только для ключей deep-links без поля в конфиге.
4. **Страница** — `XComponent extends AdvancedSearchPageBase<XTable, XForm>`:
   передать `GpoLibService` в `super()`; реализовать `table` / `createTable` /
   `getData`; в `ngOnInit` вызвать `setSearchItems(config.buildItems(...))`;
   в `ngAfterViewInit` — `initTable()` (восстановление сортировки + сохранение
   раскладки колонок) и `bindTableData()`.
5. **Шаблон**:

```html
<app-filter-display [functionUpdate]="filterDisplayValue" [names]="advancedSearchDisplayNames" [filters]="xTable.filter"></app-filter-display>

<lib-gpo-table ... [filters table bindings] ...></lib-gpo-table>

<!-- пульсация иконки — внутри компонента, по [filter] -->
<app-advanced-search-button [filter]="xTable.filter" (openSearch)="openSearch()"></app-advanced-search-button>

<app-advanced-search-rest
    #restSearch
    [items]="advancedSearchItems"
    [filter]="xTable.filter"
    [modes]="xTable.searchModes"
    (search)="onDrawerSearch($event)"
    (clear)="onDrawerClear()">
</app-advanced-search-rest>
```

6. **Сервис** — `GridifyRepository<XRow, XTable, XAggregates>` (см.
   `lib/typed-gridify/gridify-repository.ts`): весь цикл `/qry`
   (запрос → `{count,data}` → count таблицы → постобработка), полная выгрузка
   (`getData(table, postProcess, allRows=true)`) и агрегаты
   (`aggregatesFetch` + `loadAggregates(table)`); CSV —
   `gridifyGetBlob` c `table.generateGridifyRequest(true)`.

## Хуки каркаса (переопределять по необходимости)

| Хук | Когда |
|---|---|
| `beforeApplyFormFilter(form)` | правка формы перед записью в фильтр (внешние контролы, отчётные режимы) |
| `beforeApplyFilter()` / `updateData()` | синхронизация производных состояний / доп. загрузки |
| `onSearchControlChange(event)` | кросс-правила полей drawer'а (поля с `watchChange()`) |
| `applyQueryParams(params)` уже вызван страницей | свои deep-links поверх декларативных (деревья, сервисы) |
| `initTable()` (вызов страницы в ngAfterViewInit) | восстановление сортировки из localStorage + сохранение раскладки колонок после загрузок; требует `GpoLibService` в `super()` |
| `canPersistColumns()` | `false` — не сохранять раскладку колонок (спец-режимы) |
| `tableFilterStorageKey` / `canPersistTableFilter()` | персист фильтра |
| `createExportTable(totalRows)` | доп. состояние для клонов export/print |
| `table.updateAggregates()` | агрегаты, грузятся каркасом параллельно с таблицей |

## Сервисные значения страницы

- **Режимы поиска** — `table.searchModes` (ключ поля → значение before-контрола);
  каркас пишет их при поиске drawer'а, правила читают через `searchFormOptions`.
- **Значения извне** (дерево, сторонние контролы) — `setSearchFormValue(key, value)`
  (только фильтр) или `setSearchValue(key, value, { disableForm })` (фильтр + форма).
- **Deep-links** — декларативные привязки применяются `applyQueryParams(params)`;
  `expand(raw, params)` описывается в конфиге (справочники и сервисы доступны
  конструктору конфига), читает параметры-модификаторы из контекста; хук поверх —
  только для экзотики, которой не хватает данных конфига.
- **Чипы filter-display** — компонент принимает `object` + `[names]`
  (`buildAdvancedSearchDisplayNames(items)`), без типов конкретных страниц;
  верхняя граница диапазона получает подпись «(конец)»
  (`displayNames` дескриптора). `[functionUpdate]="filterDisplayValue"`:
  `displayValue` дескриптора → вывод по ключу фильтра (префикс
  «Равно / Больше / …» числовых условий, `formatFilterValue`) → подпись из
  справочника поля (label/value или key/title) → сырое значение; даты
  форматирует сам filter-display.

## Ключи фильтра (суффиксы)

Форма выдаёт плоский объект «ключ + условие»: `_contains`, `_in`, `_gte`/`_lte`,
`_eq`/`_not`/`_gt`/`_lt` (числовые условия). Правило Gridify выводится из типа
дескриптора, суффиксы едины для `getFilter` drawer'а, подписей и правил —
добавлять знания о суффиксах снаружи не нужно.

## Рецепт перевода gql-страницы на Gridify

Полный пошаговый рецепт с примерами — в
`src/app/projects/remnant/pages/warehouse-refactoring-plan.md` (§6). Коротко:

1. `x-field.ts` — ключи строки через `Utils.nameof` и `satisfies Record<keyof XQry, string>`.
2. `x-search.config.ts` — `SearchItem*`; ключ поля = ключ колонки, `setField` только при необходимости.
3. `XForm = SearchFormOf<ReturnType<XSearchConfig['buildItems']>>`.
4. `XTable extends AggregateGridifyTable` — колонки через `tableColumn`, `defaultOrder`, `configureRequest`.
5. `createSwaggerRepository` — типизированный репозиторий без `as unknown as Promise<PagedResponse<T>>`.
6. `XComponent extends AdvancedSearchPageBase` — `setSearchItems`, `initTable`, `bindTableData`, `applyFilter`.

Новые элементы стека:

- `AggregateGridifyTable` — один `updateAggregates`, подкласс задаёт `aggregateTargets`,
  `fetchAggregates`, `applyAggregates`;
- `createSwaggerRepository` — фабрика `GridifyRepository` поверх swagger-метода
  `(Page, PageSize, OrderBy, Filter)`;
- `tableColumn`, `markActiveColumns` — колонки без позиционного `ColumnFiltered`;
- `copyTableForExport` — единый клон фильтра/режимов/сортировки для выгрузки;
- `wordsJoin` в `GridifySearchTable` — И/ИЛИ только для поиска по словам;
- `AdvancedSearchPageBase.filterItems` — чипы фильтра для шапки выгрузки без `ViewChild`;
- `SearchItem.setRequestOnly()` — поле переводит только `configureRequest` таблицы;
- `WORD_SEARCH_MODES`, `SEARCH_CONNECT_OPTIONS` — общие списки режимов;
- `buildFilterItems` (`components/filter-display/filter-items.ts`) — один алгоритм чипов
  для экрана и выгрузки;
- защита от гонок: поздний ответ старого фильтра не затирает свежие данные.

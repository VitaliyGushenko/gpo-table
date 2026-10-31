---
name: naming
description: Правила наименований в коде is_nsi. Загружать при выборе имени для нового класса, метода, поля, переменной, сигнала, при переименовании и при ревью названий («как назвать», «переименуй», «имя не нравится», «непонятное имя»).
---

# Наименования в is_nsi

Главный принцип: **имя должно быть понятным и конкретным даже для разработчика, плохо владеющим английским**. Простые частотные слова, никакой «красивой» лексики. Имя — инструкция, которую можно дословно перевести и выполнить над данными.

## Правила

1. **Только простые частотные слова.** Глаголы и существительные первой сотни английского языка:
   - глаголы: `get`, `set`, `add`, `remove`, `delete`, `update`, `create`, `build`, `fill`, `find`, `check`, `prepare`, `load`, `save`, `send`, `open`, `close`, `run`, `reset`, `clear`, `copy`, `count`, `sort`, `filter`, `show`, `hide`, `parse`, `format`, `move`;
   - существительные: `plan`, `list`, `table`, `row`, `node`, `field`, `page`, `user`, `filter`, `header`, `file`, `status`, `version`.
   Отдельные слова допустимы только в буквальном смысле: `attach` — «прикрепить файлы» (`attachSurveyFilesToRows`), не «добавить данные».
2. **Запрещены редкие и «умные» слова** — их смысл неочевиден без словаря:
   - ~~enrich~~ → `prepare` / `fill` / `add` (пример: `enrichPlanNodes` → `preparePlanNodesForDisplay`);
   - ~~decorate~~ → `add`; ~~utilize~~ → `use`; ~~retrieve~~ → `get`; ~~populate~~ → `fill`; ~~commence~~ → `start`; ~~augment~~ → `add`; ~~facilitate~~ → `help`; ~~handle~~ → конкретный глагол результата (`openPlan`, а не `handleCardClick`); ~~process~~ → конкретный глагол того, что делается.
3. **Конкретность вместо общности.** Имя отвечает на вопрос «что именно делает или содержит»:
   - плохо: `processData`, `doWork`, `info`, `manager`, `helper`, `common`;
   - хорошо: `preparePlanNodesForDisplay`, `buildWhere`, `loadPlanHeader`, `attachSurveyFilesToRows`.
4. **Глагол первым** в методах и функциях: `loadPlanHeader`, `addPurchases`. Существительное — в классах, интерфейсах, типах: `PlanDocument`, `HalfYearPlanListTable`, `PlanListFilters`.
5. **Метод = что + над чем**: `attachSurveyFilesToRows`, а не `enrich`; одного глагола мало, если он не говорит над чем и зачем.
6. **Булевы — через `is`/`has`/`can`/`should`**: `isArchived`, `canAddCorrection`, `hasPlanActions`.
7. **Если простое имя не описывает суть — метод делает слишком много.** Это сигнал разбить его, а не подбирать хитрое имя.

## Сигналы, события, сервисы (конвенции проекта)

Из эталонной страницы планов закупок и proplan; сверяйся с ними, а не с общей практикой Angular:

- **Сигналы — camelCase без суффикса `$`, обычно `readonly`:** `readonly isLoadingData = signal(false)`, `readonly checkedAll = signal(false)`. Булевы — через `is/has/can`.
- **`computed` — так же, без `$`:** `readonly checkedCount = computed(...)`, `readonly canArchive = computed(...)`.
- **`@Output()` dumb-компонента — простое событие camelCase без префикса `on`:** `commentSave`, `create`, `update`, `valueChange`.
- **Инжектированные сервисы:** приватные — `private readonly _msg = inject(NzMessageService)` (с подчёркиванием); публичные (используемые шаблоном/снаружи) — без: `readonly permissions = inject(PlanListPermissionsService)`.
- **State-сервисы страницы — `<Домен><Роль>Service`, один файл — одна роль:** `PlanDocumentService`, `PlanSelectionService`, `PlanExportService`, `PlanActionsService`; файлы kebab-case.

## Проверка имени

Переведи имя дословно. Перевод звучит как выполнимая инструкция над данными («подготовь узлы плана к отображению», «прикрепи файлы опросных листов к строкам») — имя хорошее. Перевод не говорит, что произойдёт («обогати узлы», «обработай данные») — переименуй.

Требования стиля (kebab-case файлы, суффиксы `.component.ts`/`.service.ts`, селекторы `app-*`) — в скилле `dev`, здесь они не дублируются.

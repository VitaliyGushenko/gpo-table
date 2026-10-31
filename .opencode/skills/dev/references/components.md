# Образцы кода: компоненты, state-сервисы, токены

Образцы взяты из эталонной страницы планов закупок:
`src/app/projects/buy/pages/centralized-purshases/pages/plans/components/plan-table/` (далее — `plan-table/`).
Код сокращён до сути, полные файлы читай на месте.

## 1. Dumb-компонент

Источник: `src/app/projects/buy/pages/centralized-purshases/components/comment/comment.component.ts`.

```ts
@Component({
    selector: 'app-comment',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NzSpinModule, NzIconModule, FormsModule, NzButtonModule, TextEditorModule],
    template: `
        @let hiddenTextEdit = isHiddenTextEdit();
        <nz-spin [nzSpinning]="isLoading">
            @if (hiddenTextEdit) {
                <span class="comment" [innerHTML]="comment ?? ''"></span>
            } @else {
                <text-editor placeholder="Введите комментарий..." [(ngModel)]="draft"></text-editor>
            }
        </nz-spin>
    `,
})
export class CommentComponent implements OnChanges {
    @Input() comment: string;
    @Input() viewMode = true;
    @Input() isLoading = false;

    @Output() commentSave = new EventEmitter<string>();

    /** Черновик комментария в режиме редактирования */
    protected draft: string;

    /** Флаг отображения редактора */
    protected isHiddenTextEdit = signal(true);

    ngOnChanges(): void {
        this.draft = this.comment;
    }

    /** Сохранение: отдаёт новое значение родителю, ничего не сохраняет сам */
    protected save(): void {
        this.commentSave.emit(this.draft);
        this.isHiddenTextEdit.set(true);
    }
}
```

Существенные детали:

- Члены, используемые шаблоном, — `protected` (не public «на всякий случай»).
- Вход с режимом просмотра (`viewMode`) — почти у каждого редактируемого элемента он есть; отсутствие проверки прав в dumb-компоненте не баг, права решает smart-уровень.
- `ngOnChanges` синхронизирует вход → локальный черновик; черновик не пишется обратно во вход.
- Шаблон — новый control flow (`@let`, `@if … {} @else {}`). Шаблон и стили до ~100 строк каждый держи инлайн в ts-файле (`template`, `styles`), крупные — выноси в `templateUrl`/`styleUrl`.

## 2. State-сервис страницы

Источник: `plan-table/services/plan-page-state.service.ts`.

```ts
@Injectable() // не providedIn: 'root' — провайдится страницей
export class PlanPageStateService {
    private readonly _msg = inject(NzMessageService);
    private readonly _doc = inject(PlanDocumentService);
    private readonly _versions = inject(PlanVersionsService);
    private readonly _api = inject(PLAN_TABLE_API);

    /** Глобальный индикатор «идёт операция на странице» */
    readonly isLoadingData = signal(false);

    /** Доступен ли раздел «Архив» — производное от прав, статуса и версии */
    readonly canArchive = computed(() => {
        const doc = this._doc.docVersion();
        return (
            !!doc &&
            !this._versions.viewMode() &&
            !!this._userService?.user?.access?.buy?.canEditPurchasePlans() &&
            (doc.statusId === DocStatus.design || doc.statusId === DocStatus.approved)
        );
    });

    /** Единая обработка ошибки: сообщение, Sentry, при необходимости модалка */
    fail(error: unknown, modalTitle?: string): void {
        Utils.showError(error, this._msg.error.bind(this._msg));
        SentryErrorHandler.sendSentryMessage(error as Error);
    }

    private async savePurchaseComment(data: PurchaseType, comment: string): Promise<void> {
        const request = { comment, purchaseIds: [data.id] };
        try {
            this.isLoadingData.set(true);
            await firstValueFrom(this._api.purchases.setPurchasesComment(request, this._docRef));
            data.comment = comment;
            this._msg.success('Комментарий успешно изменён!');
            this._page.refreshView();
        } catch (error) {
            this.fail(error);
        } finally {
            this.isLoadingData.set(false); // снимается всегда, иначе вечный спиннер
        }
    }
}
```

Существенные детали:

- Зависимости — `inject()` в приватные readonly-поля с подчёркиванием: `private readonly _msg = inject(NzMessageService)`.
- Набор сервисов на страницу: `plan-page-state` (индикаторы, ошибки, просмотровые действия), `plan-document`, `plan-actions`, `plan-export`, `plan-agreement`, `plan-sign`, `plan-versions` — каждый узкий, а не один «бог-сервис».
- API-запросы из UI-действий — по схеме `try { isLoading.set(true); await firstValueFrom(...) } catch { fail(e) } finally { isLoading.set(false) }`.
- Производные значения (права, доступность кнопок) — `computed`, а не методы, вызываемые из шаблона.
- Открытие модалки dumb-компонента с данными и выходами — тоже в сервисе:

```ts
showPlanInfo(data: PurchaseType) {
    this._injectService.open<PlanInfoComponent>(
        PlanInfoComponent,
        { nzTitle: 'Просмотр сведений о закупке', nzFooter: null, nzWidth: 800 },
        { data, isCommentViewMode: …, listVersions: this._doc.listVersions() }, // входы
        { commentSave: (comment: string) => this.savePurchaseComment(data, comment) }, // выходы
    );
}
```

## 3. Контракт данных через InjectionToken

Источник: `plan-table/plan-table-api.ts` и страница-обёртка `plans/half-year/table/table.component.ts`.

```ts
// Контракт: только то, что нужно странице; поля-объекты по смыслу (approval, purchases, archive)
export interface PlanTableApi {
    getUserRights(planId: number, versionId: number): Observable<PlanUserRights>;
    loadPlanData(planId: number, versionId: number): Promise<PlanDocument>;
    readonly approval: PlanApprovalApi;
    readonly purchases: PlanPurchasesApi;
    readonly archive: PlanArchiveApi;
}

export const PLAN_TABLE_API = new InjectionToken<PlanTableApi>('PLAN_TABLE_API');
```

```ts
// Тонкая обёртка конкретной страницы: только подстановка реализации и конфига
@Component({
    selector: 'app-half-year-plan',
    standalone: true,
    imports: [PlanTablePageComponent],
    template: ` <app-plan-table-page /> `,
    providers: [
        { provide: PLAN_TABLE_API, useClass: HalfYearPlanTableApi },
        { provide: PLAN_TABLE_CONFIG, useValue: HALF_YEAR_PLAN_TABLE_CONFIG },
    ],
})
export class HalfYearPlanComponent {}
```

Реализация (`half-year/table/settings/table-api.ts`, у оптового плана — `wholesale/table/settings/table-api.ts`) — `@Injectable({ providedIn: 'root' })`, делегирует в swagger/GraphQL-сервисы и маппит их ответы в модели страницы. Тот же приём: `PLAN_LIST_API`, `PLAN_TABLE_CONFIG`, `MID_GANT_CONFIG`, `WINDOW`.

## 4. Структура фичи

```
src/app/projects/<домен>/                 # домены: buy, mid, balance, proplan, nsi, …
    pages/…/components/plan-table/
        plan-table-api.ts                 # контракт + токен (без суффикса .service)
        plan-table-config.ts
        classes/                          # базовые классы таблиц, модели строк
        models/                           # document.ts, purchases-fields.ts
        services/                         # state-, actions-, document-, export-сервисы
        ui/                               # dumb-компоненты и smart-страница
            plan-table-page/
            plan-info/
        _index.ts                         # барель
```

- Псевдонимы путей: `@swagger/api`, `gpo-lib`, `@ias/models`, `@ias/services`, `@ias/<домен>/…` — использовать вместо длинных относительных путей, когда адресат входит в барель.
- Общие компоненты — `src/app/components/<имя>/`; прежде чем писать новое, проверь, нет ли там и в `gpo-lib` готового.

## 5. Типовые ошибки

- Мутация объекта из `@Input()` в надежде на перерисовку — при OnPush не сработает; меняй сигнал/вход в родителе.
- `providedIn: 'root'` у сервиса с состоянием страницы: две открытые страницы начнут делить один сигнал.
- `subscribe()` в компоненте без `takeUntilDestroyed(this.destroy$)` — утечка на каждый заход на страницу.
- `await` без `try/finally`: любая ошибка запроса оставляет `isLoading = true` навсегда.
- Дублирование правки viewMode внутри dumb-шаблона вместо одного входа `viewMode`/`isCommentViewMode`, вычисленного в сервисе.
- Обращение к данным до проверки: `doc.id` без `!!doc` в computed, где `doc` может быть `null`.
- Ссылки через `../../../..` на общие вещи — есть `@ias/*` и `gpo-lib`.

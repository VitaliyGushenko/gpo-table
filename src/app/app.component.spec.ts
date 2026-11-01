import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';

import { AppComponent } from './app.component';

describe('AppComponent', () => {
    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AppComponent],
            providers: [provideRouter([]), provideNoopAnimations()],
        }).compileComponents();
    });

    it('should create the app', () => {
        const fixture = TestBed.createComponent(AppComponent);
        const app = fixture.componentInstance;
        expect(app).toBeTruthy();
    });

    it(`should have the 'gpo-table' title`, () => {
        const fixture = TestBed.createComponent(AppComponent);
        const app = fixture.componentInstance;
        expect(app.title).toEqual('gpo-table');
    });

    it('строит меню навигации по трём демо-таблицам', () => {
        const fixture = TestBed.createComponent(AppComponent);
        fixture.detectChanges();

        const links = Array.from(
            fixture.nativeElement.querySelectorAll('li[nz-menu-item] a'),
        ) as HTMLAnchorElement[];

        expect(links.map((link) => link.textContent?.trim())).toEqual([
            'Реестр записей',
            'Сотрудники',
            'Заказы',
        ]);
        expect(links.map((link) => link.getAttribute('href'))).toEqual([
            '/registry',
            '/employees',
            '/orders',
        ]);
    });
});

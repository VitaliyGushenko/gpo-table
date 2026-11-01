import { registerLocaleData } from '@angular/common';
import localeRu from '@angular/common/locales/ru';
import { ApplicationConfig, LOCALE_ID, provideZoneChangeDetection } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { CopyOutline, DeleteOutline, EditOutline, EyeOutline } from '@ant-design/icons-angular/icons';
import { provideNzIcons } from 'ng-zorro-antd/icon';

import { routes } from './app.routes';

registerLocaleData(localeRu, 'ru-RU');

export const appConfig: ApplicationConfig = {
    providers: [
        provideZoneChangeDetection({ eventCoalescing: true }),
        provideAnimations(),
        provideRouter(routes),
        provideNzIcons([EditOutline, DeleteOutline, CopyOutline, EyeOutline]),
        { provide: LOCALE_ID, useValue: 'ru-RU' },
    ],
};

import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('./demo/gpo-table-demo/gpo-table-demo.component').then(
                (module) => module.GpoTableDemoComponent,
            ),
    },
];

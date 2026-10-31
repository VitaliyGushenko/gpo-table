import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('./lib/data-table/demo/registry-table-demo.component').then(
                (module) => module.RegistryTableDemoComponent,
            ),
    },
];

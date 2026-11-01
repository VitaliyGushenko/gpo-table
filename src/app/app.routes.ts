import { Routes } from '@angular/router';

export const routes: Routes = [
    { path: '', pathMatch: 'full', redirectTo: 'registry' },
    {
        path: 'registry',
        loadComponent: () =>
            import('./demo/gpo-table-demo/gpo-table-demo.component').then(
                (module) => module.GpoTableDemoComponent,
            ),
    },
    {
        path: 'employees',
        loadComponent: () =>
            import('./demo/employees-table-demo/employees-table-demo.component').then(
                (module) => module.EmployeesTableDemoComponent,
            ),
    },
    {
        path: 'orders',
        loadComponent: () =>
            import('./demo/orders-table-demo/orders-table-demo.component').then(
                (module) => module.OrdersTableDemoComponent,
            ),
    },
    { path: '**', redirectTo: 'registry' },
];

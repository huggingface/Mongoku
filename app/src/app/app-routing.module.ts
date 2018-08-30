import { NgModule }             from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { ServersComponent } from './pages/servers/servers.component';
import { DatabasesComponent } from './pages/databases/databases.component';
import { CollectionsComponent } from './pages/collections/collections.component';
import { ExploreComponent } from './pages/explore/explore.component';
import { DocumentComponent } from './pages/document/document.component';

const routes: Routes = [
  { path: 'servers/:server/databases/:database/collections/:collection/documents/:document', component: DocumentComponent },
  { path: 'servers/:server/databases/:database/collections/:collection',                     component: ExploreComponent },
  { path: 'servers/:server/databases/:database/collections',                                 component: CollectionsComponent },
  { path: 'servers/:server/databases/:database',                                             redirectTo: "/servers/:server/databases/:database/collections" },
  { path: 'servers/:server/databases',                                                       component: DatabasesComponent },
  { path: 'servers/:server',                                                                 redirectTo: "/servers/:server/databases" },
  { path: 'servers',                                                                         component: ServersComponent },
  { path: '',                                                                                redirectTo: "/servers", pathMatch: 'full' }
];

@NgModule({
  imports: [ RouterModule.forRoot(routes, { enableTracing: false }) ],
  exports: [ RouterModule ]
})
export class AppRoutingModule {}
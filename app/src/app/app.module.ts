import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { UrlSerializer } from '@angular/router';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

import { AppComponent } from './app.component';
import { AppRoutingModule, UrlSerializerFix } from './app-routing.module';
import { PagesModule } from './pages/pages.module';
import { ComponentsModule } from './components/components.module';
import { FiltersModule } from './filters/filters.module';
import { ServicesModule } from './services/services.module';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    NgbModule,
    AppRoutingModule,
    PagesModule,
    ComponentsModule,
    FiltersModule,
    ServicesModule
  ],
  providers: [{ provide: UrlSerializer, useClass: UrlSerializerFix }],
  bootstrap: [
    AppComponent
  ]
})
export class AppModule { }

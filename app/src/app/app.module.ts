import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

import { MonacoEditorModule, NgxMonacoEditorConfig } from 'ngx-monaco-editor';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { PagesModule } from './pages/pages.module';
import { ComponentsModule } from './components/components.module';
import { FiltersModule } from './filters/filters.module';
import { ServicesModule } from './services/services.module';

const monacoConfig: NgxMonacoEditorConfig = {
  onMonacoLoad: async () => {
    // monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    //   // validate: false,
    //   schemas: []
    // });
  }
}

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    NgbModule.forRoot(),
    MonacoEditorModule.forRoot(monacoConfig),
    AppRoutingModule,
    PagesModule,
    ComponentsModule,
    FiltersModule,
    ServicesModule
  ],
  providers: [],
  bootstrap: [
    AppComponent
  ]
})
export class AppModule { }

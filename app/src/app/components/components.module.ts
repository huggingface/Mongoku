import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PanelComponent } from './panel/panel.component';
import { PrettyJsonComponent } from './pretty-json/pretty-json.component';

@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [ PanelComponent, PrettyJsonComponent ],
  exports: [ PanelComponent, PrettyJsonComponent ]
})
export class ComponentsModule { }

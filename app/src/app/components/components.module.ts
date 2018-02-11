import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PanelComponent } from './panel/panel.component';

@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [ PanelComponent ],
  exports: [ PanelComponent ]
})
export class ComponentsModule { }

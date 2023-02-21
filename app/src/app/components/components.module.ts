import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

import { PanelComponent } from './panel/panel.component';
import { PrettyJsonComponent } from './pretty-json/pretty-json.component';
import { SearchBoxComponent } from './search-box/search-box.component';
import { NotificationsComponent } from './notifications/notifications.component';

import { CodemirrorModule } from '@ctrl/ngx-codemirror';
import 'codemirror/mode/javascript/javascript';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    NgbModule,
    CodemirrorModule,
  ],
  declarations: [PanelComponent, PrettyJsonComponent, SearchBoxComponent, NotificationsComponent],
  exports: [PanelComponent, PrettyJsonComponent, SearchBoxComponent, NotificationsComponent]
})
export class ComponentsModule { }

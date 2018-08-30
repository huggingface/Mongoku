import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';

import { MongoDbService } from './mongo-db.service';
import { NotificationsService } from './notifications.service';

@NgModule({
  imports: [
    CommonModule,
    HttpClientModule
  ],
  declarations: [],
  providers: [ MongoDbService, NotificationsService ]
})
export class ServicesModule { }

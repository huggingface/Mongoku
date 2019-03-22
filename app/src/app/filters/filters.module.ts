import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BytesPipe } from './bytes.pipe';
import { NumberPipe } from './number.pipe';
import { ServerNamePipe } from './server-name.pipe';

@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [ BytesPipe, NumberPipe, ServerNamePipe ],
  exports: [ BytesPipe, NumberPipe, ServerNamePipe ]
})
export class FiltersModule { }

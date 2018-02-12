import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BytesPipe } from './bytes.pipe';
import { NumberPipe } from './number.pipe';

@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [ BytesPipe, NumberPipe ],
  exports: [ BytesPipe, NumberPipe ]
})
export class FiltersModule { }

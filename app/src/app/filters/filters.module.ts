import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BytesPipe } from './bytes.pipe';

@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [ BytesPipe ],
  exports: [ BytesPipe ]
})
export class FiltersModule { }

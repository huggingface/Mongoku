import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'bytes'
})
export class BytesPipe implements PipeTransform {
  private units = [
    "B", "KB", "MB", "GB", "TB", "PB"
  ];
  
  transform(value: any): any {
    let n = value;
    let i = 0;
    for (const unit of this.units) {
      if (n / 1024 > 1) {
        n = n / 1024;
        i ++;
      } else {
        break;
      }
    }
    return `${n.toFixed(2)} ${this.units[i]}`;
  }

}

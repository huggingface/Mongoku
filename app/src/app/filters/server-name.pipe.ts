import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'serverName'
})
export class ServerNamePipe implements PipeTransform {

  transform(value: any, args?: any): any {
    let [name, port] = (value || "").split(':');

    if (port == "27017") {
      return name;
    }
    return value;
  }

}

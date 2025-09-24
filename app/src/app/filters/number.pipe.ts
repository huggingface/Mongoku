import { Pipe, PipeTransform } from "@angular/core";

@Pipe({
  name: "number",
})
export class NumberPipe implements PipeTransform {
  private pad(n: number) {
    if (n < 1000 && n >= 100) {
      return `${n}`;
    } else if (n < 100 && n >= 10) {
      return `0${n}`;
    } else if (n < 10 && n >= 0) {
      return `00${n}`;
    }
  }

  transform(value: number): any {
    if (typeof value === "string") {
      value = parseFloat(value);
    }

    const parts: string[] = [];
    while (value > 1000) {
      const remainer = value % 1000;
      parts.unshift(this.pad(remainer));
      value -= remainer;
      value /= 1000;
    }

    let text = `${value}`;
    if (parts.length > 0) {
      text += `,${parts.join(",")}`;
    }
    return text;
  }
}

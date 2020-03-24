export namespace Utils {
  /**
   * In-place sort of the given array of objects
   * @param arr An array of objects
   * @param field the field used to sort
   * @param descending whether to use descending order
   */
  export const fieldSort = (arr: Object[], field: string, descending: boolean = false) => {
    return arr.sort((a, b) => {
      return (a[field] == b[field])
        ? 0
        : (a[field] > b[field])
          ? (descending) ? -1 : 1
          : (descending) ? 1 : -1
    });
  }


  export function anyPromise<T>(arr: Promise<T>[]) : Promise<T> {
    return new Promise<T>(resolve =>
      Promise.all(arr.map(p => p.then(r => r && resolve(r)))).then(() => resolve(undefined))
    );
  }

  export function applyPromiseSequence<T>(fn: Function, ...arr: Array<Array<T>>) : Promise<T> {
    return new Promise<T>(resolve =>
      arr.filter(x => x && x.length)
        .reduce((accP, args) => 
            accP.then(y => y || fn(args).then((x: T) => { if (x) { resolve(x); return x; } }))
        ,Promise.resolve(undefined)) 
    )
  }
}

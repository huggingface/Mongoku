import { Component, OnInit, Input, Output, EventEmitter, AfterViewInit, AfterViewChecked } from '@angular/core';

export interface SearchParams {
  query: string;
  sort:  string;
  limit: number;
  skip:  number;
}

@Component({
  selector: 'search-box',
  templateUrl: './search-box.component.html',
  styleUrls: ['./search-box.component.scss']
})
export class SearchBoxComponent implements OnInit {
  @Output() search = new EventEmitter<SearchParams>();
  
  private defaults = {
    limit: 20,
    skip:  0,
    sort:  ""
  }
  
  private params = {
    query: "{}",
    limit: this.defaults.limit,
    skip:  this.defaults.skip,
    sort:  this.defaults.sort
  };
  
  private show = {
    limit: false,
    skip:  false,
    sort:  false
  };
  
  ngOnInit() {
    // Launch the initial update after the current change cycle
    setTimeout(() => {
      this.go();
    }, 0);
  }
  
  toggle(add: boolean, type: "limit" | "skip" | "sort") {
    this.show[type] = add;
    if (!add) {
      this.params[type] = this.defaults[type];
    }
  }

  canAddParams() {
    return Object.values(this.show).some(v => !v);
  }

  go() {
    this.search.emit(this.params);
  }
}

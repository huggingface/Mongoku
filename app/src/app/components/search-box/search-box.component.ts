import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';

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
  @Output() search = new EventEmitter();
  @Input()  params: SearchParams = {
    query: "{}",
    limit: 20,
    skip:  0,
    sort:  ""
  };
  
  private defaults = {};
  show = {
    limit: false,
    skip:  false,
    sort:  false
  };
  
  ngOnInit() {
    // Keep original params
    for (const [k, v] of Object.entries(this.params)) {
      this.defaults[k] = v;
    }
    
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
    if (this.params.query === "") {
      this.params.query = "{}";
    }
    
    this.search.emit();
  }
  
  keyPress(event) {
    if (event.keyCode === 13) {
      this.go();
    }
  }
}

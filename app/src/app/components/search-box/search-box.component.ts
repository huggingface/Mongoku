import { Component, OnInit, Input, Output, EventEmitter, OnChanges } from '@angular/core';

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
export class SearchBoxComponent implements OnInit, OnChanges {
  @Output() search = new EventEmitter();
  @Input()  params: SearchParams;
  
  private ready = false;
  private defaults = {
    query: "{}",
    limit: 20,
    skip:  0,
    sort:  ""
  };
  show = {
    limit: false,
    skip:  false,
    sort:  false
  };
  
  ngOnInit() {
    // Keep original params
    for (const [k, v] of Object.entries(this.defaults)) {
      if (typeof this.params[k] !== typeof v) {
        // Bad value, use default
        this.params[k] = v;
      } else {
        // good value, update default
        this.defaults[k] = this.params[k];
      }
      
      if (this.params[k] !== v) {
        this.show[k] = true;
      }
    }
    
    this.ready = true;
    this.go();
  }
  
  ngOnChanges() {
    if (!this.ready) { return; }
    
    this.go();
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

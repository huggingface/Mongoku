import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { MongoDbService } from '../../services/mongo-db.service';

import { SearchParams } from '../../components/search-box/search-box.component';

@Component({
  selector: 'app-explore',
  templateUrl: './explore.component.html',
  styleUrls: ['./explore.component.scss']
})
export class ExploreComponent implements OnInit {
  private server:     string;
  private database:   string;
  private collection: string;
  
  private ready = false;
  
  private params: SearchParams = {
    query:  "{}",
    limit:  20,
    skip:   0,
    sort:   ""
  };
  private loading    = {
    content: true,
    count:   true
  };
  
  private count      = {
    total: 0,
    start: 0
  }
  private items      = [];
  
  constructor(private activatedRoute: ActivatedRoute, private mongoDb: MongoDbService) { }
  
  ngOnInit() {
    this.activatedRoute.paramMap.subscribe((d) => {
      this.server     = d.get("server");
      this.database   = d.get("database");
      this.collection = d.get("collection");
      
      this.ready = true;
      this.update();
    });
  }
  
  update() {
    if (!this.params || !this.ready) { return; }
    
    // Content
    this.loading.content = true;
    this.mongoDb.query(this.server, this.database, this.collection, this.params.query, this.params.sort, this.params.skip, this.params.limit)
      .subscribe((res: any) => {
        this.loading.content = false;
        
        if (res.ok) {
          this.items = res.results;
        }
      });
    
    // Count
    this.loading.count = true;
    this.mongoDb.count(this.server, this.database, this.collection, this.params.query)
      .subscribe((res: any) => {
        this.loading.count = false;
        
        if (res.ok) {
          this.count.total = res.count;
          this.count.start = this.params.skip;
        }
      });
  }
  
  get hasNext() {
    return this.count.start + this.items.length < this.count.total;
  }
  
  next() {
    this.params.skip = this.params.skip + this.params.limit;
    this.update();
  }
  
  get hasPrevious() {
    return this.count.start > 0;
  }
  
  previous() {
    this.params.skip = Math.max(0, this.params.skip - this.params.limit);
    this.update();
  }

}

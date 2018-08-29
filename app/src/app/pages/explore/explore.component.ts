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
  
  // CODEMIRROR OPTIONS
  //   searchOptions = {
  //     mode: 'application/json',
  //     theme: 'neo'
  //   }
  
  private lastReq    = "";
  
  private params?: SearchParams;
  private loading    = false;
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
    
    const req = Object.values(this.params).sort().join('|');
    if (req === this.lastReq) {
      return;
    }
    this.lastReq = req;
    
    this.loading = true;
    this.mongoDb.query(this.server, this.database, this.collection, this.params.query, this.params.sort, this.params.skip, this.params.limit)
      .subscribe((res: any) => {
        this.loading = false;
        
        if (res.ok) {
          this.items = res.results;
        }
      });
  }
  
  search(params) {
    this.params = params;
    this.update();
  }

}

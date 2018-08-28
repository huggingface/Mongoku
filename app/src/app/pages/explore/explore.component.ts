import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { MongoDbService } from '../../services/mongo-db.service';

@Component({
  selector: 'app-explore',
  templateUrl: './explore.component.html',
  styleUrls: ['./explore.component.scss']
})
export class ExploreComponent implements OnInit {
  private server:     string;
  private database:   string;
  private collection: string;
  
  // CODEMIRROR OPTIONS
  //   searchOptions = {
  //     mode: 'application/json',
  //     theme: 'neo'
  //   }
  
  private query      = "{}";
  private skip       = 0;
  private limit      = 20;
  private order      = "";
  
  private loading    = false;
  private items      = [];
  
  constructor(private activatedRoute: ActivatedRoute, private mongoDb: MongoDbService) { }
  
  ngOnInit() {
    this.activatedRoute.paramMap.subscribe((d) => {
      this.server     = d.get("server");
      this.database   = d.get("database");
      this.collection = d.get("collection");
      
      this.update();
    });
  }
  
  update() {
    this.loading = true;
    
    const s = this.mongoDb.query(this.server, this.database, this.collection, this.query, this.skip, this.limit)
      .subscribe((res: any) => {
        this.loading = false;
          
        if (res.ok) {
          this.items = res.results;
        }
      });
  }

}

import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { MongoDbService } from '../../services/mongo-db.service';

@Component({
  selector: 'app-explore',
  templateUrl: './explore.component.html',
  styleUrls: ['./explore.component.scss']
})
export class ExploreComponent implements OnInit {
  server:     string;
  database:   string;
  collection: string;
  
  //   search = 
  // `{ 
  //   content: "Your message here",
  //   _id: "1234566",
  //   b: true
  // }`;

  //   searchOptions = {
  //     mode: 'application/json',
  //     theme: 'neo'
  //   }
  
  query = "{}";
  skip  = 0;
  limit = 20;
  
  items = [ {
    title: "TOTO"
  }, {
    title: "TATA"
  } ]
  
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
    const s = this.mongoDb.query(this.server, this.database, this.collection, this.query, this.skip, this.limit)
      .subscribe((res: any) => {
        if (res.ok) {
          this.items = res.results;
        }
      });
  }

}

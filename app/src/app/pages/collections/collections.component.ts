import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { MongoDbService, CollectionJSON } from '../../services/mongo-db.service';

@Component({
  selector: 'app-collections',
  templateUrl: './collections.component.html',
  styleUrls: ['./collections.component.scss']
})
export class CollectionsComponent implements OnInit {
  server:   string;
  database: string;
  collections: CollectionJSON[];
  
  constructor(public activatedRoute: ActivatedRoute, private mongoDb: MongoDbService) { }

  ngOnInit() {
    this.activatedRoute.paramMap.subscribe((d) => {
      this.server   = d.get("server");
      this.database = d.get("database");
      
      this.mongoDb.getCollections(this.server, this.database)
        .subscribe((collections) => {
          this.collections = collections;
        });
    });
  }

}

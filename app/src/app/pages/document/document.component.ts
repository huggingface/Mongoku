import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { MongoDbService } from '../../services/mongo-db.service';
import { JsonParserService } from '../../services/json-parser.service';

@Component({
  selector: 'app-document',
  templateUrl: './document.component.html',
  styleUrls: ['./document.component.scss']
})
export class DocumentComponent implements OnInit {
  server:     string;
  database:   string;
  collection: string;
  document:   string;
  
  item;
  
  constructor(private activatedRoute: ActivatedRoute, private mongodb: MongoDbService, private jsonParser: JsonParserService) { }

  ngOnInit() {
    this.activatedRoute.paramMap.subscribe((d) => {
      this.server     = d.get("server");
      this.database   = d.get("database");
      this.collection = d.get("collection");
      this.document   = d.get("document");
      
      this.get();
    })
  }
  
  get() {
    this.mongodb.getDocument(this.server, this.database, this.collection, this.document).subscribe((res: any) => {
      if (res.ok) {
        this.item = res.document;
      }
    });
  }

}

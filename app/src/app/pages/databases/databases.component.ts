import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { MongoDbService, DatabaseJSON } from '../../services/mongo-db.service';

@Component({
  selector: 'app-databases',
  templateUrl: './databases.component.html',
  styleUrls: ['./databases.component.scss']
})
export class DatabasesComponent implements OnInit {
  server:    string;
  databases: DatabaseJSON[] = [];
  loading = true;

  constructor(private activatedRoute: ActivatedRoute, private mongoDb: MongoDbService) { }

  ngOnInit() {
    this.activatedRoute.paramMap.subscribe((d) => {
      this.server = d.get("server");
      
      this.mongoDb.getDatabases(this.server)
        .subscribe((databases) => {
          this.loading = false;
          this.databases = databases;
        });
    });
  }

}

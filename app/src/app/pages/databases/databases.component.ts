import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { MongoDbService, DatabaseJSON } from '../../services/mongo-db.service';
import { NgbPopover } from '@ng-bootstrap/ng-bootstrap';

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

  toggle(popover: NgbPopover, data: any) {
    if (popover.isOpen()) {
      popover.close();
    } else if (data !== undefined) {
      popover.open(data);
    }
  }

  toggleStats(popover: NgbPopover, database: DatabaseJSON) {
    this.toggle(popover, { stats: database });
  }

  toggleCollection(popover: NgbPopover, collection: any[]) {
    const clippedCol = collection.filter((_, i) => i < 10);
    this.toggle(popover, {
      collection: clippedCol,
      clipped: clippedCol.length < collection.length
    });
  }
}

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

  toggle(popover: NgbPopover, object: any[] | DatabaseJSON) {
    if (popover.isOpen()) {
      popover.close();
    } else if (Array.isArray(object)) {
      const clippedCol = object.filter((_, i) => i < 10);
      popover.open({
        collection: clippedCol,
        clipped: clippedCol.length < object.length
      });
    } else if (object !== undefined) {
      let totalObjSize = 0;
      let totalObjNr = 0;
      const stats = object.collections.reduce((counts, obj) => {
        totalObjSize += (obj.avgObjSize || 0) * obj.count;
        totalObjNr += obj.count;

        counts.size += obj.size;
        counts.storageSize += obj.storageSize;
        counts.totalIndexSize += obj.totalIndexSize;
        return counts;
      }, {
        size: 0,
        storageSize: 0,
        totalIndexSize: 0
      });
      popover.open({
        stats: {
          ...stats,
          avgObjSize: totalObjSize / totalObjNr
        }
      });
    }
  }
}

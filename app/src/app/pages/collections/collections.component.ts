import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { MongoDbService, CollectionJSON } from '../../services/mongo-db.service';
import { NgbPopover } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-collections',
  templateUrl: './collections.component.html',
  styleUrls: ['./collections.component.scss']
})
export class CollectionsComponent implements OnInit {
  server:      string;
  database:    string;
  collections: CollectionJSON[] = [];
  loading = true;

  constructor(private activatedRoute: ActivatedRoute, private mongoDb: MongoDbService) { }

  ngOnInit() {
    this.activatedRoute.paramMap.subscribe((d) => {
      this.server   = d.get("server");
      this.database = d.get("database");

      this.mongoDb.getCollections(this.server, this.database)
        .subscribe((collections) => {
          this.loading = false;
          this.collections = collections;
        });
    });
  }

  private indexName(raw: string): string {
    let parts = raw.replace(/_id/g, "$id").split('_');
    let indexes: any = {};
    while (parts.length > 0) {
      let field = parts.shift().replace(/\$id/g, "_id");
      let direction = parseInt(parts.shift(), 10) || 1;
      indexes[field] = direction;
    }
    return indexes;
  }

  toggle(popover: NgbPopover, data: any) {
    if (popover.isOpen()) {
      popover.close();
    } else if (data !== undefined) {
      popover.open(data);
    }
  }

  toggleStats(popover: NgbPopover, collection: CollectionJSON) {
    this.toggle(popover, { stats: collection });
  }

  toggleIndexes(popover: NgbPopover, collection: CollectionJSON) {
    const indexes = Object.entries(collection.indexSizes);
    const clippedIndexes = indexes.map(([name, size]) => {
      return {
        name: this.indexName(name),
        size
      };
    }).filter((_, i) => i < 20);
    this.toggle(popover, {
      indexes: clippedIndexes,
      clipped: indexes.length - clippedIndexes.length
    });
  }
}

import { Component, OnInit } from '@angular/core';
import { MongoDbService, ServerJSON } from '../../services/mongo-db.service';
import { NgbPopover } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-servers',
  templateUrl: './servers.component.html',
  styleUrls: ['./servers.component.scss']
})
export class ServersComponent implements OnInit {
  servers: ServerJSON[] = [];
  loading = true;

  constructor(private mongoDb: MongoDbService) { }

  ngOnInit() {
    this.mongoDb.getServers()
      .subscribe(data => {
        this.loading = false;
        this.servers = data;
      });
  }

  toggle(popover: NgbPopover, collection: any[]) {
    if (popover.isOpen()) {
      popover.close();
    } else if (collection !== undefined) {
      const clippedCol = collection.filter((_, i) => i < 10);
      popover.open({
        collection: clippedCol,
        clipped: clippedCol.length < collection.length
      });
    }
  }
}

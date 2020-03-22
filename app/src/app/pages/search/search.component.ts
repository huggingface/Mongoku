import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common'; 
import { ActivatedRoute, Router } from '@angular/router';

import { MongoDbService } from '../../services/mongo-db.service';
import { NotificationsService } from '../../services/notifications.service';

@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss']
})
export class SearchComponent implements OnInit {
  server:     string;
  database:   string;
  document:   string;
  hint:       string;

  loading = true;
  message = 'Loading...';

  constructor(
    private router:         Router,
    private location:       Location,
    private activatedRoute: ActivatedRoute,
    private mongodb:        MongoDbService,
    private notifService:   NotificationsService,
  ) { }

  ngOnInit() {
    this.activatedRoute.paramMap.subscribe((d) => {
      this.server     = d.get("server");
      this.database   = d.get("database");
      this.document   = d.get("document");
      this.hint       = d.get("hint");
      this.search();
    });
  }

  search() {
    this.mongodb.search(this.server, this.database, this.document, this.hint).subscribe((res: any) => {
      this.loading = false;
      if (!res.ok) {
          this.message = '¯\\_(ツ)_/¯ Document not found';
          return;
      }
      this.router.navigate([
        'servers',     this.server,
        'databases',   this.database,
        'collections', res.collection,
        'documents',   this.document
      ]);
    });
  }

}

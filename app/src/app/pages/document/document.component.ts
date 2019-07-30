import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { MongoDbService } from '../../services/mongo-db.service';
import { NotificationsService } from '../../services/notifications.service';

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

  loading = true;

  constructor(
    private router:         Router,
    private activatedRoute: ActivatedRoute,
    private mongodb:        MongoDbService,
    private notifService:   NotificationsService,
  ) { }

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
      this.loading = false;
      this.item = res.document;
    });
  }

  editDocument(json) {
    const partial = false;
    const newId = json && json._id && json._id.$value;
    const oldId = this.item && this.item._id && this.item._id.$value;
    if (newId !== oldId) {
      this.notifService.notifyError("ObjectId changed. This is not supported, updated canceled.");
      return ;
    }

    this.loading = true;
    this.mongodb.update(this.server, this.database, this.collection, oldId, json, partial)
      .subscribe((res: any) => {
        this.loading = false;
        this.item = res.update;
      });
  }

  remove() {
    this.mongodb.remove(this.server, this.database, this.collection, this.document)
      .subscribe((res: any) => {
        this.item = null;
        this.router.navigate([
          "servers",     this.server,
          "databases",   this.database,
          "collections", this.collection,
        ])
      });
  }

}

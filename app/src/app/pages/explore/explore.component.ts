import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest } from 'rxjs';

import { MongoDbService, toObjectId } from '../../services/mongo-db.service';

import { SearchParams } from '../../components/search-box/search-box.component';
import { JsonParserService } from '../../services/json-parser.service';
import { NotificationsService } from '../../services/notifications.service';

@Component({
  selector: 'app-explore',
  templateUrl: './explore.component.html',
  styleUrls: ['./explore.component.scss']
})
export class ExploreComponent implements OnInit {
  server:     string;
  database:   string;
  collection: string;

  readOnly = false;
  params: Partial<SearchParams>;
  loading    = {
    content: true,
    count:   true
  };

  count      = {
    total: 0,
    start: 0
  };
  items      = [];

  constructor(
    private activatedRoute: ActivatedRoute,
    private router:         Router,
    private mongoDb:        MongoDbService,
    private jsonParser:     JsonParserService,
    private notifService:   NotificationsService,
  ) { }

  ngOnInit() {
    this.mongoDb.isReadOnly().subscribe(({ readOnly }) => {
      this.readOnly = readOnly;
    });
    combineLatest(
      this.activatedRoute.paramMap,
      this.activatedRoute.queryParamMap
    ).subscribe(([params, queryParams]) => {
      this.server     = params.get('server');
      this.database   = params.get('database');
      this.collection = params.get('collection');

      let query;
      let sort;
      let limit;
      let skip;
      let project;
      if (queryParams.has('query')) {
        query = queryParams.get('query');
      }
      if (queryParams.has('project')) {
        project = queryParams.get('project');
      }
      if (queryParams.has('sort')) {
        sort = queryParams.get('sort');
      }
      if (queryParams.has('skip')) {
        skip = parseInt(queryParams.get('skip'), 10);
      }
      if (queryParams.has('limit')) {
        limit = parseInt(queryParams.get('limit'), 10);
      }
      this.params = {
        query, sort, limit, skip, project
      };
    });
  }

  update(upd: boolean = true) {
    if (!this.params || !this.params.query) { return; }

    const query = JSON.stringify(this.jsonParser.parse(this.params.query));
    const sort  = (this.params.sort !== '')
      ? JSON.stringify(this.jsonParser.parse(this.params.sort))
      : '{}';
    const project  = (this.params.project !== '')
      ? JSON.stringify(this.jsonParser.parse(this.params.project))
      : '{}';
    if (!query || !sort) { return ; }

    if (upd) {
      this.router.navigate([], {
        relativeTo:  this.activatedRoute,
        queryParams: this.params
      });
    }

    // Set loading status
    this.loading.content = true;
    this.loading.count = true;

    // Reset status
    this.items = [];
    this.count.total = 0;

    // Load Content
    this.mongoDb.query(this.server, this.database, this.collection, query, project, sort, this.params.skip, this.params.limit)
      .subscribe((res: any) => {
        this.loading.content = false;

        if (res.ok) {
          this.items = res.results;
        }
      });

    // Count documents
    this.mongoDb.count(this.server, this.database, this.collection, query)
      .subscribe((res: any) => {
        this.loading.count = false;

        if (res.ok) {
          this.count.total = res.count;
          this.count.start = this.params.skip;
        }
      });
  }

  go(documentId) {
    this.router.navigate([
      'servers',     this.server,
      'databases',   this.database,
      'collections', this.collection,
      'documents',   documentId
    ]);
  }

  editDocument(_id, json) {
    const partial = this.params.project && Object.keys(this.jsonParser.parse(this.params.project)).length > 0;
    const newId = toObjectId(json && json._id);
    const oldId = toObjectId(_id);
    if (newId !== oldId) {
      this.notifService.notifyError('ObjectId changed. This is not supported, updated canceled.');
      return ;
    }

    this.mongoDb.update(this.server, this.database, this.collection, oldId, json, partial)
      .subscribe((res: any) => {
        if (!res.ok) {
          return void this.notifService.notifyError(`Edit failed: ${res.message}`); }
        this.items.forEach((item, index) => {
          const m_id = toObjectId(item && item._id);
          if (m_id === oldId) {
            this.items[index] = res.update;
          }
        });
      });
  }

  remove(_id) {
    const document = toObjectId(_id);
    if (!document) { return; }

    this.mongoDb.remove(this.server, this.database, this.collection, document)
      .subscribe((res: any) => {
        const index = this.items.findIndex(v => toObjectId(v._id) === document);
        this.items.splice(index, 1);
      });
  }

  get hasNext() {
    return this.count.start + this.items.length < this.count.total;
  }

  next() {
    this.params.skip = this.params.skip + this.params.limit;
    this.update();
  }

  get hasPrevious() {
    return this.count.start > 0;
  }

  previous() {
    this.params.skip = Math.max(0, this.params.skip - this.params.limit);
    this.update();
  }

  goInsert() {
    this.router.navigate([
      'servers',     this.server,
      'databases',   this.database,
      'collections', this.collection,
      'new'
    ]);
  }

}

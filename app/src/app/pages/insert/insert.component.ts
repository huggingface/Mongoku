import { Component, OnInit, ElementRef, Renderer2 } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { MongoDbService } from '../../services/mongo-db.service';
import { NotificationsService} from '../../services/notifications.service';
import { JsonParserService } from '../../services/json-parser.service';

@Component({
  selector: 'app-insert',
  templateUrl: './insert.component.html',
  styleUrls: ['./insert.component.scss']
})
export class InsertComponent implements OnInit {
  server:     string;
  database:   string;
  collection: string;

  loading = true;
  editJson = '{\n\n}';
  editorOptions = {
    lineNumbers: true,
    theme:       'mongoku',
    mode:        'javascript',
    smartIndent: false,
  };

  constructor(
    private el: ElementRef,
    private renderer: Renderer2,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private mongodb: MongoDbService,
    private notifService: NotificationsService,
    private jsonParser: JsonParserService,
  ) { }

  ngOnInit() {
    this.activatedRoute.paramMap.subscribe((d) => {
      this.server     = d.get('server');
      this.database   = d.get('database');
      this.collection = d.get('collection');
      this.loading = false;
    });
  }

  private insert(json) {
    this.loading = true;
    const data = Object.assign({}, json);
    this.mongodb.insert(this.server, this.database, this.collection, json)
      .subscribe((res: any) => {
       this.loading = false;
       const {insert = {}} = res;
       if (!res.ok || insert.insertedCount < 1) {
         return void this.notifService.notifyError(`Error: ${res}`); }
       this.router.navigate([
         'servers', this.server,
         'databases', this.database,
         'collections', this.collection,
         'documents', res.insert.insertedId
       ]);
    });
  }

  save() {
    let data;
    try {
      data = this.jsonParser.parse(this.editJson, false);
    } catch (err) {
      if (typeof err.lineNumber === 'number') {
        const line = this.el.nativeElement
          .querySelector(`.CodeMirror-lines .CodeMirror-code > div:nth-child(${err.lineNumber})`);
        this.renderer.addClass(line, 'error');
      }
      const message = `"${err.description}" at column ${err.column}`;
      this.notifService.notifyError(message);
    }

    if (typeof data === 'string' || Array.isArray(data)) {
      return void this.notifService.notifyError('Document should be object'); }

    if (data) {
      this.insert(data); }
  }

  cancelEditor() {
     this.router.navigate([
       'servers', this.server,
       'databases', this.database,
       'collections', this.collection,
     ]);
  }

  updateEditor() {
    this.el.nativeElement
      .querySelectorAll(`.CodeMirror-lines .CodeMirror-code > div.error`)
      .forEach(e => this.renderer.removeClass(e, 'error'));
  }
}

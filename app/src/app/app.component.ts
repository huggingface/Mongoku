import { Component, AfterViewChecked, Renderer2, OnInit, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, RoutesRecognized } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MongoDbService } from './services/mongo-db.service';
import { NotificationsService } from './services/notifications.service';

interface Breadcrumb {
  href?: string;
  active: boolean;
  name: string;
};

declare global {
  interface Window {
    __env: string;
  }
}

@Component({
  selector: 'content',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements AfterViewChecked, OnInit {
  breadcrumbs: Breadcrumb[] = [];

  @ViewChild('signinContent', {static: false}) private signinContent;

  constructor(private route: Router, private renderer: Renderer2,
    private apiService: MongoDbService, private modalService: NgbModal,
    private http: HttpClient, private notifService: NotificationsService) { }

  ngOnInit() {
    const userTheme = localStorage.getItem("theme");
    if (userTheme == this.otherTheme) {
      this.switchTheme(userTheme);
    }
    this.apiService.authIssues.subscribe((issue) => this.signin(issue));
  }

  signin(issue: {status: number, reloadOnSignedIn: boolean}) {
    if (this.modalService.hasOpenModals()) {
      return;
    }
    const modalRef = this.modalService.open(this.signinContent, { centered: true });
    modalRef.result.then(formData => this.http.post<{ok: boolean, message: string}>('/signin', formData)
    .pipe(catchError((err) => {
      const message = typeof err.error === 'object' && err.error.message || err.error || err.statusText;
      this.notifService.notifyError(`${err.name}: ${message}`);
      return of({ok: false, message: err.error||err.message, err});
    }))
    .subscribe(v=>{
      console.log(v.message);
      if (!v.ok)
        return this.signin(issue);
      if (issue.reloadOnSignedIn)
        window.location.reload();
    }));
  }

  ngAfterViewChecked() {
    this.route.events.subscribe((data) => {
      if (data instanceof RoutesRecognized) {
        const params = data.state.root.firstChild.params;
        const breadcrumbs: Breadcrumb[] = [];

        if (params.server) {
          const server = params.server;
          breadcrumbs.push({
            name: server,
            href: `servers/${server}/databases`,
            active: false
          });

          if (params.database) {
            const database = params.database;
            breadcrumbs.push({
              name: database,
              href: `servers/${server}/databases/${database}/collections`,
              active: false
            });

            if (params.collection) {
              const collection = params.collection;
              breadcrumbs.push({
                name: collection,
                href: `servers/${server}/databases/${database}/collections/${collection}`,
                active: false
              });

              if (params.document) {
                const document = params.document;
                breadcrumbs.push({
                  name: document,
                  active: false
                });
              }
            }
          }
        }

        if (breadcrumbs.length > 0) {
          breadcrumbs[breadcrumbs.length - 1].href = undefined;
          breadcrumbs[breadcrumbs.length - 1].active = true;
        }

        this.breadcrumbs = breadcrumbs;
      }
    });
  }

  get otherTheme() {
    const isLight = document.body.classList.contains("theme-light");
    return isLight ? "Dark" : "Light";
  }

  switchTheme(theme: string) {
    if (theme === "Dark") {
      this.renderer.removeClass(document.body, "theme-light");
    } else {
      this.renderer.addClass(document.body, "theme-light");
    }
    localStorage.setItem("theme", theme);
  }
}

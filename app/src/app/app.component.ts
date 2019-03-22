import { Component, AfterViewChecked, Renderer2, OnInit } from '@angular/core';
import { Router, RoutesRecognized } from '@angular/router';

interface Breadcrumb {
  href?:   string;
  active: boolean;
  name:   string;
};

@Component({
  selector: 'content',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements AfterViewChecked, OnInit {
  breadcrumbs: Breadcrumb[] = [];

  constructor(private route: Router, private renderer: Renderer2) { }

  ngOnInit() {
    const currentTheme = localStorage.getItem("theme");
    if (currentTheme == this.otherTheme) {
      this.switchTheme(this.otherTheme);
    }
  }

  ngAfterViewChecked() {
    this.route.events.subscribe((data) => {
       if (data instanceof RoutesRecognized) {
        const params = data.state.root.firstChild.params;
        const breadcrumbs: Breadcrumb[] = [];

        if (params.server) {
          const server = params.server;
          breadcrumbs.push({
            name:   server,
            href:   `/servers/${server}/databases`,
            active: false
          });

          if (params.database) {
            const database = params.database;
            breadcrumbs.push({
              name:   database,
              href:   `/servers/${server}/databases/${database}/collections`,
              active: false
            });

            if (params.collection) {
              const collection = params.collection;
              breadcrumbs.push({
                name:   collection,
                href:   `/servers/${server}/databases/${database}/collections/${collection}`,
                active: false
              });

              if (params.document) {
                const document = params.document;
                breadcrumbs.push({
                  name:   document,
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
    return isLight
      ? "Dark"
      : "Light";
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

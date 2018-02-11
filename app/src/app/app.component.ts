import { Component, AfterViewChecked } from '@angular/core';
import { Router, RoutesRecognized } from '@angular/router';
import { PACKAGE_ROOT_URL } from '@angular/core/src/application_tokens';

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
export class AppComponent implements AfterViewChecked {
  breadcrumbs: Breadcrumb[] = [];
  
  constructor(private route: Router) { }
  
  ngAfterViewChecked() {
    const d = this.route.events.subscribe((data) => {
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
                active: false
              })
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
  
}

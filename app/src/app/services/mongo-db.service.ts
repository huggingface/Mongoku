import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { throwError, Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ServerJSON, ServerErrorJSON } from '../../../../lib/Server';
import { DatabaseJSON } from '../../../../lib/Database';
import { CollectionJSON } from '../../../../lib/Collection';

import { NotificationsService } from './notifications.service';

export { ServerJSON, DatabaseJSON, CollectionJSON };

@Injectable()
export class MongoDbService {
  private apiBaseUrl: string = "/api";
  
  constructor(private http: HttpClient, private notifService: NotificationsService) { }
  
  private handleError(error: HttpErrorResponse) {
    this.notifService.notifyError(error.error.message);
    return throwError(error.error.message);
  }
  
  private get<T>(path: string, options?: any) {
    // The following cast is required to get the right typing
    // since we expect and receive an Observable<T> and not a
    // Observable<HttpEvent<T>>. Weird
    return <any>this.http.get<T>(path, options)
      .pipe(
        catchError((err) => this.handleError(err))
      ) as Observable<T>;
  }
  
  getServers() {
    return this.get<ServerJSON[]>(`${this.apiBaseUrl}/servers`);
  }
  
  getDatabases(server: string) {
    return this.get<DatabaseJSON[]>(`${this.apiBaseUrl}/servers/${server}/databases`)
  }
  
  getCollections(server: string, database: string) {
    return this.get<CollectionJSON[]>(`${this.apiBaseUrl}/servers/${server}/databases/${database}/collections`);
  }
  
  getDocument(server: string, database: string, collection: string, document: string) {
    return this.get(`${this.apiBaseUrl}/servers/${server}/databases/${database}/collections/${collection}/documents/${document}`);
  }

  query(server: string, database: string, collection: string, query: any, sort: any, skip: number = 0, limit: number = 20) {
    return this.get(`${this.apiBaseUrl}/servers/${server}/databases/${database}/collections/${collection}/query`, {
      params: {
        q:     query,
        sort:  sort,
        skip:  `${skip}`,
        limit: `${limit}`
      }
    });
  }
  
  count(server: string, database: string, collection: string, query: any) {
    return this.get(`${this.apiBaseUrl}/servers/${server}/databases/${database}/collections/${collection}/count`, {
      params: {
        q: query
      }
    });
  }
}

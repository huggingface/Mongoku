import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ServerJSON } from '../../../../lib/Server';
import { DatabaseJSON } from '../../../../lib/Database';
import { CollectionJSON } from '../../../../lib/Collection';

import { NotificationsService } from './notifications.service';

export { ServerJSON, DatabaseJSON, CollectionJSON };

@Injectable()
export class MongoDbService {
  private apiBaseUrl: string = "api";

  constructor(private http: HttpClient, private notifService: NotificationsService) { }

  private handleError(error: HttpErrorResponse) {
    const message = error.error.message || `${error.name}: ${error.statusText}`;
    this.notifService.notifyError(message);
    return of({
      ok:      false,
      message: message
    });
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

  private post<T>(path: string, body: any, options?: any) {
    // The following cast is required to get the right typing
    // since we expect and receive an Observable<T> and not a
    // Observable<HttpEvent<T>>. Weird
    return <any>this.http.post<T>(path, body, options)
      .pipe(
        catchError((err) => this.handleError(err))
      ) as Observable<T>;
  }

  private put<T>(path: string, body: any, options?: any) {
    // The following cast is required to get the right typing
    // since we expect and receive an Observable<T> and not a
    // Observable<HttpEvent<T>>. Weird
    return <any>this.http.put<T>(path, body, options)
      .pipe(
        catchError((err) => this.handleError(err))
      ) as Observable<T>;
  }

  private delete<T>(path: string, options?: any) {
    // The following cast is required to get the right typing
    // since we expect and receive an Observable<T> and not a
    // Observable<HttpEvent<T>>. Weird
    return <any>this.http.delete<T>(path, options)
      .pipe(
        catchError((err) => this.handleError(err))
      ) as Observable<T>;
  }

  getServers() {
    return this.get<ServerJSON[]>(`${this.apiBaseUrl}/servers`);
  }

  addServer(url: string) {
    return this.put(`${this.apiBaseUrl}/servers`, { url: url });
  }

  removeServer(server: string) {
    return this.delete(`${this.apiBaseUrl}/servers/${server}`);
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

  search(server: string, database: string, document: string, hint?: string) {
    const qs = !hint ? '' : `?hint=${hint}`;
    return this.get(`${this.apiBaseUrl}/servers/${server}/databases/${database}/search/${document}/${qs}`);
  }

  query(server: string, database: string, collection: string, query: any, project: any, sort: any, skip: number = 0, limit: number = 20) {
    return this.get(`${this.apiBaseUrl}/servers/${server}/databases/${database}/collections/${collection}/query`, {
      params: {
        q:     query,
        sort:  sort,
        skip:  `${skip}`,
        limit: `${limit}`,
        project: `${project}`
      }
    });
  }

  update(server: string, database: string, collection: string, document: string, update: any, partial: boolean) {
    return this.post(`${this.apiBaseUrl}/servers/${server}/databases/${database}/collections/${collection}/documents/${document}`, update, {
      params: {
        partial: `${partial}`
      }
    });
  }

  remove(server: string, database: string, collection: string, document: string) {
    return this.delete(`${this.apiBaseUrl}/servers/${server}/databases/${database}/collections/${collection}/documents/${document}`);
  }

  count(server: string, database: string, collection: string, query: any) {
    return this.get(`${this.apiBaseUrl}/servers/${server}/databases/${database}/collections/${collection}/count`, {
      params: {
        q: query
      }
    });
  }
}

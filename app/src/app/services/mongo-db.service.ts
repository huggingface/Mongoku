import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { ServerJSON, ServerErrorJSON } from '../../../../lib/Server';
import { DatabaseJSON } from '../../../../lib/Database';
import { CollectionJSON } from '../../../../lib/Collection';

export { ServerJSON, DatabaseJSON, CollectionJSON };

@Injectable()
export class MongoDbService {
  private apiBaseUrl: string = "/api";
  
  constructor(private http: HttpClient) { }
  
  getServers() {
    return this.http.get<ServerJSON[]>(`${this.apiBaseUrl}/servers`);
  }
  
  getDatabases(server: string) {
    return this.http.get<DatabaseJSON[]>(`${this.apiBaseUrl}/servers/${server}/databases`);
  }
  
  getCollections(server: string, database: string) {
    return this.http.get<CollectionJSON[]>(`${this.apiBaseUrl}/servers/${server}/databases/${database}/collections`);
  }

  query(server: string, database: string, collection: string, query: any, sort: any, skip: number = 0, limit: number = 20) {
    return this.http.get(`${this.apiBaseUrl}/servers/${server}/databases/${database}/collections/${collection}/query`, {
      params: {
        q:     query,
        sort:  sort,
        skip:  `${skip}`,
        limit: `${limit}`
      }
    });
  }
  
  count(server: string, database: string, collection: string, query: any) {
    return this.http.get(`${this.apiBaseUrl}/servers/${server}/databases/${database}/collections/${collection}/count`, {
      params: {
        q: query
      }
    });
  }
}

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

}

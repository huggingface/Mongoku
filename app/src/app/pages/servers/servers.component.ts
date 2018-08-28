import { Component, OnInit } from '@angular/core';
import { MongoDbService, ServerJSON } from '../../services/mongo-db.service';

@Component({
  selector: 'app-servers',
  templateUrl: './servers.component.html',
  styleUrls: ['./servers.component.scss']
})
export class ServersComponent implements OnInit {
  private servers: ServerJSON[];
  
  constructor(private mongoDb: MongoDbService) { }

  ngOnInit() {
    this.mongoDb.getServers()
      .subscribe(data => {
        this.servers = data;
      });
  }

}

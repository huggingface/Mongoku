import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-explore',
  templateUrl: './explore.component.html',
  styleUrls: ['./explore.component.scss']
})
export class ExploreComponent implements OnInit {
  search = 
`{ 
  content: "Your message here",
  _id: "1234566",
  b: true
}`;

  searchOptions = {
    mode: 'application/json',
    theme: 'neo'
  }
  
  constructor() { }

  ngOnInit() {
  }

}

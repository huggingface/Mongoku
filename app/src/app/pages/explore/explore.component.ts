import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-explore',
  templateUrl: './explore.component.html',
  styleUrls: ['./explore.component.scss']
})
export class ExploreComponent implements OnInit {
  editorOptions = {
    theme: 'vs-dark',
    language: 'json',
    lineNumbers: "off",
    automaticLayout: true,
    minimap: {
      enabled: false
    },
    scrollbar: {
      handleMouseWheel: false,
      vertical: "hidden",
      horizontal: "hidden"
    },
    codeLens: false,
    snippetSuggestions: "none",
    quickSuggestions: false,
    parameterHints: false,
    occurencesHighlight: false,
    suggestOnTriggerCharacters: false,
    wordBasedSuggestions: false,
    hideCursorInOverviewRuler: true,
    renderLineHighlight: "none",
    acceptSuggestionOnCommitCharacter: false,
    overviewRulerBorder: false,
    contextmenu: false
  }
  search = `{ content: "Your message here", _id: "1234566", b: true }`;
  
  constructor() { }

  ngOnInit() {
  }

}

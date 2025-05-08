import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-navigation-menu',
  templateUrl: './navigation-menu.component.html',
  styleUrls: ['./navigation-menu.component.scss']
})
export class NavigationMenuComponent implements OnInit {
  @Input() set navigationData(data: NavigationData) {
    this.navData = data;
  }

  @Input() hasAnnotatedData: boolean = false;

  navData: NavigationData = {
    predPMIDPathways: [],
    ppiPathways: []
  };

  ngOnInit(): void {
    console.log('data', this.navData);
  }

  scrollToSection(id: string) {
    // wait a moment to ensure the view has rendered (if necessary)
    setTimeout(() => {
      const section = document.getElementById(id);
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 0);
  }

}

export interface NavigationData {
  predPMIDPathways: string[]; //for list predicted pathway details)
  ppiPathways: string[]; //for listing ppis for each pathway)
}

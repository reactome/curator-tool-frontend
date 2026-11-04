import { Component, Input } from '@angular/core';

/** One entry of the Gene2Path outline: the id of the element to scroll to, its label, and its depth (0 = section). */
export interface OutlineSection {
  id: string;
  label: string;
  level?: 0 | 1;
}

@Component({
  selector: 'app-navigation-menu',
  templateUrl: './navigation-menu.component.html',
  styleUrls: ['./navigation-menu.component.scss']
})
export class NavigationMenuComponent {
  @Input() sections: OutlineSection[] = [];

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

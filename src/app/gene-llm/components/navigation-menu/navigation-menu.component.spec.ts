import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';

import { componentTestImports } from 'src/testing';
import { NavigationMenuComponent } from './navigation-menu.component';

describe('NavigationMenuComponent', () => {
  let component: NavigationMenuComponent;
  let fixture: ComponentFixture<NavigationMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [...componentTestImports()],
      declarations: [NavigationMenuComponent],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(NavigationMenuComponent);
    component = fixture.componentInstance;
  });

  it('starts with no sections', () => {
    expect(component.sections).toEqual([]);
  });

  it('lists one link per section, indenting the sub-sections', () => {
    component.sections = [
      { id: 'annotated_pathways', label: 'Annotated Pathways' },
      { id: 'predicted_pathways', label: 'Predicted Pathways' },
      { id: 'fi_partners', label: 'FI Partners', level: 1 },
    ];
    fixture.detectChanges();

    const links = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('a'));
    expect(links.map(a => a.textContent?.trim())).toEqual(['Annotated Pathways', 'Predicted Pathways', 'FI Partners']);
    expect(links[2].classList).toContain('level_1');
    expect(links[0].classList).toContain('level_0');
  });

  it('scrolls the requested section into view', fakeAsync(() => {
    const section = document.createElement('div');
    section.id = 'pathway-glycolysis';
    const scrollIntoView = jasmine.createSpy('scrollIntoView');
    (section as any).scrollIntoView = scrollIntoView;
    document.body.appendChild(section);

    component.scrollToSection('pathway-glycolysis');
    // The scroll is deferred so the section has rendered before it is measured.
    tick();

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    section.remove();
  }));

  it('does nothing when the requested section is not on the page', fakeAsync(() => {
    expect(() => {
      component.scrollToSection('no-such-section');
      tick();
    }).not.toThrow();
  }));
});

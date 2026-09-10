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

  it('starts with no pathways in either section', () => {
    expect(component.navData).toEqual({ predPMIDPathways: [], ppiPathways: [] });
  });

  it('hides both sections until data says otherwise', () => {
    expect(component.hasAnnotatedData).toBeFalse();
    expect(component.hasPPIData).toBeFalse();
  });

  it('takes its sections through the navigationData setter', () => {
    component.navigationData = {
      predPMIDPathways: ['Cell cycle', 'Glycolysis'],
      ppiPathways: ['Signalling']
    };

    expect(component.navData.predPMIDPathways).toEqual(['Cell cycle', 'Glycolysis']);
    expect(component.navData.ppiPathways).toEqual(['Signalling']);
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

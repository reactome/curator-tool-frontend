import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SearchCriterium } from 'src/app/core/models/reactome-instance.model';
import { componentTestImports } from 'src/testing';
import { SearchInstanceComponent } from './search-filter.component';

describe('SearchFilterComponent', () => {
  let component: SearchInstanceComponent;
  let fixture: ComponentFixture<SearchInstanceComponent>;

  const criterion: SearchCriterium = {
    attributeName: 'displayName',
    operand: 'Contains',
    searchKey: 'cyclin'
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [...componentTestImports()],
      declarations: [SearchInstanceComponent],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(SearchInstanceComponent);
    component = fixture.componentInstance;
  });

  it('starts with no accumulated criteria', () => {
    expect(component.criteria).toEqual([]);
  });

  it('offers a blank condition defaulting to a display-name contains search', () => {
    // This is the most common search a curator runs, so it is what the builder opens on.
    expect(component.blankAttributeCondition).toEqual({
      attributeName: 'displayName',
      operand: 'Contains',
      searchKey: ''
    });
  });

  it('starts with the search panel hidden', () => {
    expect(component.hideSearchPanel).toEqual('hidden');
  });

  it('emits a condition for the parent to add to the query', () => {
    // This component only groups the conditions; the owning view runs the search.
    const emitted: SearchCriterium[] = [];
    component.addSearchCriterium.subscribe(c => emitted.push(c));

    component.addAttribute(criterion);

    expect(emitted).toEqual([criterion]);
  });

  it('emits a search request without re-sending the condition', () => {
    const searches: void[] = [];
    const added: SearchCriterium[] = [];
    component.search.subscribe(() => searches.push(undefined as any));
    component.addSearchCriterium.subscribe(c => added.push(c));

    component.performSearch(criterion);

    expect(searches.length).toEqual(1);
    expect(added.length).toEqual(0);
  });

  it('emits the condition to remove', () => {
    const emitted: SearchCriterium[] = [];
    component.removeSearchCriterium.subscribe(c => emitted.push(c));

    component.removeAttribute(criterion);

    expect(emitted).toEqual([criterion]);
  });

  it('emits the index of the chip that was dismissed', () => {
    // Removing by index rather than by value matters: two identical conditions would
    // otherwise both disappear when one chip is dismissed.
    const emitted: number[] = [];
    component.removeSearchCriteriumAt.subscribe(i => emitted.push(i));

    component.removeCriterion(2);

    expect(emitted).toEqual([2]);
  });

  it('recognises null operands so the term field can be hidden', () => {
    expect(component.isNullOperand('IS NULL')).toBeTrue();
    expect(component.isNullOperand('IS NOT NULL')).toBeTrue();
    expect(component.isNullOperand('Contains')).toBeFalse();
    expect(component.isNullOperand('')).toBeFalse();
  });

  describe('a condition too long for one line', () => {
    const long: SearchCriterium = {
      attributeName: 'dbId',
      operand: 'Regex',
      searchKey: Array.from({ length: 100 }, (_, i) => 1000000 + i).join('|')
    };

    // ResizeObserver reports asynchronously, after layout.
    const settle = async () => {
      fixture.detectChanges();
      await new Promise(resolve => setTimeout(resolve, 50));
      fixture.detectChanges();
    };
    const toggle = (): HTMLButtonElement | null => fixture.nativeElement.querySelector('.condition-toggle');
    const text = (): HTMLElement => fixture.nativeElement.querySelector('.condition-text');

    beforeEach(() => {
      fixture.nativeElement.style.display = 'block';
      fixture.nativeElement.style.width = '400px';
      document.body.appendChild(fixture.nativeElement);
    });

    afterEach(() => fixture.nativeElement.remove());

    it('is shown collapsed to its first line, with a toggle to expand it', async () => {
      component.criteria = [long];
      await settle();

      expect(text().classList).toContain('collapsed');
      expect(toggle()).not.toBeNull();
      expect(toggle()!.getAttribute('aria-expanded')).toBe('false');

      toggle()!.click();
      await settle();

      expect(text().classList).not.toContain('collapsed');
      expect(text().offsetHeight).toBeGreaterThan(60);
      expect(toggle()!.getAttribute('aria-expanded')).toBe('true');

      toggle()!.click();
      await settle();

      expect(text().classList).toContain('collapsed');
      expect(toggle()).not.toBeNull();
    });

    it('gets no toggle when it fits', async () => {
      component.criteria = [criterion];
      await settle();

      expect(toggle()).toBeNull();
    });
  });
});

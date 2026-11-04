import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { componentTestImports } from 'src/testing';
import {
  ConfigurationComponentComponent,
  DEFAULT_LLM_CONFIG
} from './configuration-component.component';

describe('ConfigurationComponentComponent', () => {
  let component: ConfigurationComponentComponent;
  let fixture: ComponentFixture<ConfigurationComponentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [...componentTestImports()],
      declarations: [ConfigurationComponentComponent],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(ConfigurationComponentComponent);
    component = fixture.componentInstance;
  });

  it('starts from the default configuration', () => {
    expect(component.configuration).toEqual(DEFAULT_LLM_CONFIG);
  });

  it('starts from a copy, so editing the form cannot rewrite the defaults', () => {
    // The default is a module-level singleton; binding it directly would make "reset" a
    // no-op after the first edit.
    expect(component.configuration).not.toBe(DEFAULT_LLM_CONFIG);
  });

  it('offers FDR cutoffs from no filtering down to 1e-5', () => {
    expect(component.fdrOptions).toEqual([1, 0.05, 0.01, 0.001, 0.0001, 0.00001]);
  });

  it('restores every edited field on reset', () => {
    component.configuration.fi_cutoff = 0.5;
    component.configuration.max_pathways = 42;
    component.configuration.fdr_cutoff = 1;

    component.resetValues();

    expect(component.configuration).toEqual(DEFAULT_LLM_CONFIG);
  });

  it('resets in place, so the binding held by the parent still sees the change', () => {
    const bound = component.configuration;
    component.configuration.top_partners = 3;

    component.resetValues();

    expect(component.configuration).toBe(bound);
    expect(bound.top_partners).toEqual(DEFAULT_LLM_CONFIG.top_partners);
  });

  it('leaves the module default untouched after an edit and a reset', () => {
    component.configuration.fi_cutoff = 0.5;
    component.resetValues();

    expect(DEFAULT_LLM_CONFIG.fi_cutoff).toEqual(0.8);
  });
});

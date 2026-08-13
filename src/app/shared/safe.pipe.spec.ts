import { TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';

import { SafePipe } from './safe.pipe';

describe('SafePipe', () => {
  it('create an instance', () => {
    // SafePipe takes a DomSanitizer; constructing it with no argument stopped compiling (and
    // took the whole karma build down with it) once the pipe gained that dependency.
    const pipe = new SafePipe(TestBed.inject(DomSanitizer));
    expect(pipe).toBeTruthy();
  });
});

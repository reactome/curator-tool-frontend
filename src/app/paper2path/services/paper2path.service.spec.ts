/// <reference types="jasmine" />

import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { Paper2pathService } from './paper2path.service';
import { environment } from 'src/environments/environment.dev';

describe('Paper2pathService', () => {
  let service: Paper2pathService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [Paper2pathService]
    });
    service = TestBed.inject(Paper2pathService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should handle successful annotation submission', async () => {
    const mockResponse = { job_id: 'test-123', status: 'running' as const };
    const request = { pmids: ['12345678'] };

    const promise = firstValueFrom(service.submitAnnotation(request));
    
    const req = httpMock.expectOne(`${environment.llmURL}/crewai/annotate`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.pmids).toEqual(['12345678']);
    
    req.flush(mockResponse);
    
    const result = await promise;
    expect(result).toEqual(mockResponse);
  });

  it('should handle annotation submission error', async () => {
    const request = { pmids: ['12345678'] };

    const promise = firstValueFrom(service.submitAnnotation(request));
    
    const req = httpMock.expectOne(`${environment.llmURL}/crewai/annotate`);
    req.flush({ message: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });

    try {
      await promise;
      fail('Should have thrown an error');
    } catch (error: any) {
      expect(error.message).toContain('Server error');
    }
  });

  it('should handle getJobStatus error', async () => {
    const promise = firstValueFrom(service.getJobStatus('bad-id'));

    const req = httpMock.expectOne(`${environment.llmURL}/crewai/result/bad-id`);
    req.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });

    try {
      await promise;
      fail('Should have thrown an error');
    } catch (error: any) {
      expect(error.message).toContain('Not found');
    }
  });

  it('should validate PMID format', () => {
    expect(service.isValidPmid('12345678')).toBe(true);
    expect(service.isValidPmid('123')).toBe(true);
    expect(service.isValidPmid('abc123')).toBe(false);
    expect(service.isValidPmid('123456789')).toBe(false); // Too long
    expect(service.isValidPmid('')).toBe(false);
  });

  it('should extract PMIDs from text', () => {
    const text = 'Please check papers 12345678, 87654321 and also 999';
    const pmids = service.extractPmidsFromText(text);
    expect(pmids).toEqual(['12345678', '87654321', '999']);
  });
});
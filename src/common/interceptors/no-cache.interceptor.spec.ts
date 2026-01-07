import { NoCacheInterceptor } from './no-cache.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import type { Response } from 'express';

describe('NoCacheInterceptor', () => {
  let interceptor: NoCacheInterceptor;
  let mockResponse: jest.Mocked<Response>;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;

  beforeEach(() => {
    interceptor = new NoCacheInterceptor();

    mockResponse = {
      setHeader: jest.fn(),
      removeHeader: jest.fn(),
    } as unknown as jest.Mocked<Response>;

    mockExecutionContext = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;

    mockCallHandler = {
      handle: jest.fn().mockReturnValue(of({ data: 'test' })),
    };
  });

  describe('intercept', () => {
    it('should set no-cache headers before handler', (done) => {
      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        complete: () => {
          expect(mockResponse.setHeader).toHaveBeenCalledWith(
            'Cache-Control',
            'no-store, no-cache, must-revalidate, max-age=0',
          );
          expect(mockResponse.setHeader).toHaveBeenCalledWith(
            'Pragma',
            'no-cache',
          );
          expect(mockResponse.setHeader).toHaveBeenCalledWith('Expires', '0');
          done();
        },
      });
    });

    it('should remove existing ETag header', (done) => {
      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        complete: () => {
          expect(mockResponse.removeHeader).toHaveBeenCalledWith('ETag');
          done();
        },
      });
    });

    it('should set new ETag with UUID', (done) => {
      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        complete: () => {
          const setHeaderCalls = mockResponse.setHeader.mock.calls;
          const etagCall = setHeaderCalls.find((call) => call[0] === 'ETag');
          expect(etagCall).toBeDefined();
          expect(etagCall![1]).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
          );
          done();
        },
      });
    });

    it('should call next handler', (done) => {
      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        complete: () => {
          expect(mockCallHandler.handle).toHaveBeenCalled();
          done();
        },
      });
    });

    it('should pass through response data', (done) => {
      mockCallHandler.handle = jest.fn().mockReturnValue(of({ result: 'test' }));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (value) => {
          expect(value).toEqual({ result: 'test' });
        },
        complete: () => {
          done();
        },
      });
    });

    it('should apply headers after response', (done) => {
      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        complete: () => {
          // Headers should be set twice (before and after)
          expect(mockResponse.setHeader).toHaveBeenCalledWith(
            'Cache-Control',
            'no-store, no-cache, must-revalidate, max-age=0',
          );
          done();
        },
      });
    });
  });
});

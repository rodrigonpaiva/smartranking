import { Test, TestingModule } from '@nestjs/testing';
import {
  HttpException,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { AllExceptionsFilter } from './http-exception.filter';
import { StructuredLoggerService } from '../logger/logger.service';
import type { ArgumentsHost } from '@nestjs/common';
import type { Request, Response } from 'express';

const mockLoggerService = {
  log: jest.fn(),
  logException: jest.fn(),
  error: jest.fn(),
};

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  const createMockResponse = (): Partial<Response> => {
    const response: Partial<Response> = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    return response;
  };

  const createMockRequest = (): Partial<Request> => {
    return {
      url: '/api/test',
      requestId: 'req-123',
    };
  };

  const createMockHost = (
    request: Partial<Request>,
    response: Partial<Response>,
  ): ArgumentsHost => {
    return {
      switchToHttp: () => ({
        getRequest: () => request as Request,
        getResponse: () => response as Response,
      }),
    } as ArgumentsHost;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AllExceptionsFilter,
        { provide: StructuredLoggerService, useValue: mockLoggerService },
      ],
    }).compile();

    filter = module.get<AllExceptionsFilter>(AllExceptionsFilter);
    jest.clearAllMocks();
  });

  describe('catch', () => {
    it('should handle HttpException', () => {
      const response = createMockResponse();
      const request = createMockRequest();
      const host = createMockHost(request, response);
      const exception = new BadRequestException('Invalid input');

      filter.catch(exception, host);

      expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/api/test',
          requestId: 'req-123',
          error: expect.objectContaining({
            statusCode: HttpStatus.BAD_REQUEST,
            message: 'Invalid input',
          }),
        }),
      );
    });

    it('should handle NotFoundException', () => {
      const response = createMockResponse();
      const request = createMockRequest();
      const host = createMockHost(request, response);
      const exception = new NotFoundException('Resource not found');

      filter.catch(exception, host);

      expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockLoggerService.logException).toHaveBeenCalled();
    });

    it('should handle InternalServerErrorException', () => {
      const response = createMockResponse();
      const request = createMockRequest();
      const host = createMockHost(request, response);
      const exception = new InternalServerErrorException();

      filter.catch(exception, host);

      expect(response.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });

    it('should handle generic Error', () => {
      const response = createMockResponse();
      const request = createMockRequest();
      const host = createMockHost(request, response);
      const exception = new Error('Something went wrong');

      filter.catch(exception, host);

      expect(response.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Internal server error',
          }),
        }),
      );
    });

    it('should handle non-Error objects', () => {
      const response = createMockResponse();
      const request = createMockRequest();
      const host = createMockHost(request, response);
      const exception = { custom: 'error' };

      filter.catch(exception, host);

      expect(response.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });

    it('should handle null exception', () => {
      const response = createMockResponse();
      const request = createMockRequest();
      const host = createMockHost(request, response);

      filter.catch(null, host);

      expect(response.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });

    it('should handle string exception', () => {
      const response = createMockResponse();
      const request = createMockRequest();
      const host = createMockHost(request, response);

      filter.catch('String error', host);

      expect(response.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });

    it('should include timestamp in response', () => {
      const response = createMockResponse();
      const request = createMockRequest();
      const host = createMockHost(request, response);
      const exception = new BadRequestException('Test');

      filter.catch(exception, host);

      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(String),
        }),
      );
    });

    it('should handle exception with array message', () => {
      const response = createMockResponse();
      const request = createMockRequest();
      const host = createMockHost(request, response);
      const exception = new BadRequestException({
        message: ['Error 1', 'Error 2'],
        error: 'Bad Request',
      });

      filter.catch(exception, host);

      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: ['Error 1', 'Error 2'],
          }),
        }),
      );
    });

    it('should log exception details', () => {
      const response = createMockResponse();
      const request = createMockRequest();
      const host = createMockHost(request, response);
      const exception = new BadRequestException('Test error');

      filter.catch(exception, host);

      expect(mockLoggerService.logException).toHaveBeenCalledWith(
        exception,
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
          path: '/api/test',
          requestId: 'req-123',
        }),
      );
    });

    it('should handle request without requestId', () => {
      const response = createMockResponse();
      const request: Partial<Request> = { url: '/api/test' };
      const host = createMockHost(request, response);
      const exception = new BadRequestException('Test');

      filter.catch(exception, host);

      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: null,
        }),
      );
    });

    it('should handle HttpException with object response', () => {
      const response = createMockResponse();
      const request = createMockRequest();
      const host = createMockHost(request, response);
      const exception = new HttpException(
        { error: 'Custom error', details: 'Additional info' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );

      filter.catch(exception, host);

      expect(response.status).toHaveBeenCalledWith(
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    });
  });
});

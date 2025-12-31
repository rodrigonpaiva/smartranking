import {
  ArgumentMetadata,
  BadRequestException,
  PipeTransform,
} from '@nestjs/common';

export class ValidationParamPipe implements PipeTransform<
  string | undefined,
  string
> {
  transform(value: string | undefined, metadata: ArgumentMetadata): string {
    if (typeof value !== 'string') {
      throw new BadRequestException(
        `Validation failed: No value provided for ${metadata.data}`,
      );
    }

    const sanitized = value.trim();
    if (sanitized.length === 0 || sanitized.length > 256) {
      throw new BadRequestException(
        `Validation failed: Invalid value provided for ${metadata.data}`,
      );
    }

    const safePattern = /^[a-zA-Z0-9_.@-]+$/;
    if (!safePattern.test(sanitized)) {
      throw new BadRequestException(
        `Validation failed: Unsafe characters detected for ${metadata.data}`,
      );
    }

    return sanitized;
  }
}

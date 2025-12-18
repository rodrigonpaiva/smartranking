import { PipeTransform, BadRequestException } from '@nestjs/common';
import { ChallengeStatus } from '../interfaces/challenge-status.emun';

export class ChallengeStatusValidationPipe implements PipeTransform {
  readonly allowedStatuses = [
    ChallengeStatus.ACCEPTED,
    ChallengeStatus.REJECTED,
    ChallengeStatus.CANCELED,
  ];

  transform(value: any) {
    const status = value?.status?.toUpperCase?.();
    if (!status) {
      throw new BadRequestException('Status is required');
    }
    if (!this.isStatusValid(status)) {
      throw new BadRequestException(`Status "${status}" is invalid`);
    }
    return value;
  }

  private isStatusValid(status: any) {
    const idx = this.allowedStatuses.indexOf(status);
    return idx !== -1;
  }
}

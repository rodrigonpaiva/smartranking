import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';

@Injectable()
export class ReadinessIndicator extends HealthIndicator {
  constructor(@InjectConnection() private readonly connection: Connection) {
    super();
  }

  async checkIndexes(key = 'mongodb.indexes'): Promise<HealthIndicatorResult> {
    try {
      const collections = Object.values(this.connection.collections);
      await Promise.all(collections.map((collection) => collection.indexes()));
      return this.getStatus(key, true, {
        collections: collections.length,
      });
    } catch (error) {
      return this.getStatus(key, false, {
        message: error instanceof Error ? error.message : 'Index check failed',
      });
    }
  }
}

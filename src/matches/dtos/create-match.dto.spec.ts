import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CreateMatchDto,
  MatchScoreDto,
  MatchSetDto,
  MatchTeamDto,
} from './create-match.dto';

describe('CreateMatchDto', () => {
  const validObjectId = '507f1f77bcf86cd799439011';
  const validDto = {
    categoryId: validObjectId,
    clubId: validObjectId,
    format: 'SINGLES',
    bestOf: 3,
    teams: [
      { players: [validObjectId] },
      { players: ['507f1f77bcf86cd799439012'] },
    ],
    sets: [
      {
        games: [
          { teamIndex: 0, score: 6 },
          { teamIndex: 1, score: 4 },
        ],
      },
    ],
  };

  describe('MatchScoreDto', () => {
    it('should pass with valid score', async () => {
      const dto = plainToInstance(MatchScoreDto, {
        teamIndex: 0,
        score: 6,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with negative teamIndex', async () => {
      const dto = plainToInstance(MatchScoreDto, {
        teamIndex: -1,
        score: 6,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail with negative score', async () => {
      const dto = plainToInstance(MatchScoreDto, {
        teamIndex: 0,
        score: -1,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail with non-integer values', async () => {
      const dto = plainToInstance(MatchScoreDto, {
        teamIndex: 0.5,
        score: 6,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('MatchSetDto', () => {
    it('should pass with valid set', async () => {
      const dto = plainToInstance(MatchSetDto, {
        games: [
          { teamIndex: 0, score: 6 },
          { teamIndex: 1, score: 4 },
        ],
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with tiebreak', async () => {
      const dto = plainToInstance(MatchSetDto, {
        games: [
          { teamIndex: 0, score: 7 },
          { teamIndex: 1, score: 6 },
        ],
        tiebreak: [
          { teamIndex: 0, score: 7 },
          { teamIndex: 1, score: 5 },
        ],
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with less than 2 games', async () => {
      const dto = plainToInstance(MatchSetDto, {
        games: [{ teamIndex: 0, score: 6 }],
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('MatchTeamDto', () => {
    it('should pass with valid player ids', async () => {
      const dto = plainToInstance(MatchTeamDto, {
        players: [validObjectId],
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with multiple players for doubles', async () => {
      const dto = plainToInstance(MatchTeamDto, {
        players: [validObjectId, '507f1f77bcf86cd799439012'],
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with empty players array', async () => {
      const dto = plainToInstance(MatchTeamDto, {
        players: [],
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail with invalid player ids', async () => {
      const dto = plainToInstance(MatchTeamDto, {
        players: ['invalid-id'],
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('CreateMatchDto', () => {
    it('should pass with valid dto', async () => {
      const dto = plainToInstance(CreateMatchDto, validDto);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with invalid categoryId', async () => {
      const dto = plainToInstance(CreateMatchDto, {
        ...validDto,
        categoryId: 'invalid',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail with invalid clubId', async () => {
      const dto = plainToInstance(CreateMatchDto, {
        ...validDto,
        clubId: 'invalid',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should pass with SINGLES format', async () => {
      const dto = plainToInstance(CreateMatchDto, {
        ...validDto,
        format: 'SINGLES',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with DOUBLES format', async () => {
      const dto = plainToInstance(CreateMatchDto, {
        ...validDto,
        format: 'DOUBLES',
        teams: [
          { players: [validObjectId, '507f1f77bcf86cd799439012'] },
          { players: ['507f1f77bcf86cd799439013', '507f1f77bcf86cd799439014'] },
        ],
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with invalid format', async () => {
      const dto = plainToInstance(CreateMatchDto, {
        ...validDto,
        format: 'INVALID',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail with bestOf less than 1', async () => {
      const dto = plainToInstance(CreateMatchDto, {
        ...validDto,
        bestOf: 0,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should pass with valid decidingSetType', async () => {
      const types = ['STANDARD', 'ADVANTAGE', 'SUPER_TIEBREAK_7', 'SUPER_TIEBREAK_10'];
      for (const type of types) {
        const dto = plainToInstance(CreateMatchDto, {
          ...validDto,
          decidingSetType: type,
        });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });

    it('should fail with invalid decidingSetType', async () => {
      const dto = plainToInstance(CreateMatchDto, {
        ...validDto,
        decidingSetType: 'INVALID',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail with less than 2 teams', async () => {
      const dto = plainToInstance(CreateMatchDto, {
        ...validDto,
        teams: [{ players: [validObjectId] }],
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail with more than 2 teams', async () => {
      const dto = plainToInstance(CreateMatchDto, {
        ...validDto,
        teams: [
          { players: [validObjectId] },
          { players: ['507f1f77bcf86cd799439012'] },
          { players: ['507f1f77bcf86cd799439013'] },
        ],
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail with empty sets', async () => {
      const dto = plainToInstance(CreateMatchDto, {
        ...validDto,
        sets: [],
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should pass with valid playedAt date', async () => {
      const dto = plainToInstance(CreateMatchDto, {
        ...validDto,
        playedAt: '2024-01-15T10:30:00.000Z',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail with invalid playedAt date', async () => {
      const dto = plainToInstance(CreateMatchDto, {
        ...validDto,
        playedAt: 'invalid-date',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});

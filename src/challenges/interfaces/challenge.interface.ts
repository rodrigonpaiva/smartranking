import { Document } from 'mongoose';
import { Player } from '../../players/interfaces/players.interface';
import { ChallengeStatus } from './challenge-status.emun';

export interface Challenge extends Document {
  DateHourChallenge: Date;
  status: ChallengeStatus;
  DateHourReq: Date;
  DateHourResp: Date;
  Applicant: Player | string;
  category: string;
  players: Array<Player>;
  match: Match;
}

export interface Match extends Document {
  category: string;
  players: Array<Player | string>;
  def: Player | string;
  result: Array<Result>;
}

export interface Result {
  set: string;
}

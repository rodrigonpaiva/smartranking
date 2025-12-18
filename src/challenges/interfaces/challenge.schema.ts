import * as mongosee from 'mongoose';

export const ChallengeSchema = new mongosee.Schema(
  {
    DateHourChallenge: { type: Date },
    status: { type: String },
    DateHourReq: { type: Date },
    DateHourResp: { type: Date },
    Applicant: { type: mongosee.Schema.Types.ObjectId, ref: 'Player' },
    category: { type: String },
    players: [{ type: mongosee.Schema.Types.ObjectId, ref: 'Player' }],
    match: { type: mongosee.Schema.Types.ObjectId, ref: 'Match' },
  },
  { timestamps: true, collection: 'Challenges' },
);

export interface RankingEntry {
  _id: string;
  email: string;
  phone: string;
  clubId: string;
  name: string;
  rating: number;
  position: number;
  pictureUrl: string;
  wins: number;
  losses: number;
  draws: number;
  matches: number;
  lastMatchAt: Date | null;
}

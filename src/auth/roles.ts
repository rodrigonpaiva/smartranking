export const Roles = {
  SYSTEM_ADMIN: 'system_admin',
  CLUB: 'club',
  PLAYER: 'player',
} as const;

export type UserRole = (typeof Roles)[keyof typeof Roles];

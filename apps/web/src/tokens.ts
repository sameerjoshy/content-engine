import tokens from './tokens.json';

export type Tokens = typeof tokens;
export const T = tokens;

export const STATUS_ICON: Record<string, string> = tokens.statusIcons;
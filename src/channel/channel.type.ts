export enum Permission {
  MEMBER = 0,
  ADMIN,
  OWNER,
}

export enum Penalty {
  NONE = 0,
  MUTE,
  BAN,
}

export enum ChannelType {
  PUBLIC = 0,
  PRIVATE,
  PROTECTED,
}

export enum Invite {
  NONE = 0,
  SUCCESS,
  NOT_FOUND_USER,
  ALREADY_JOINED,
}
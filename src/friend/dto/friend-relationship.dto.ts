import { IsNumber } from 'class-validator';

export class FriendRelationshipDto {
  @IsNumber()
  readonly userId: number;

  @IsNumber()
  readonly otherId: number;
}

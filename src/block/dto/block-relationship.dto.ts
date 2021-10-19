import { IsNumber } from 'class-validator';

export class BlockRelationshipDto {
  @IsNumber()
  readonly userId: number;

  @IsNumber()
  readonly otherId: number;
}

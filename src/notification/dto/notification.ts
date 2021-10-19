import { IsNumber } from 'class-validator';

export class NotificationDto {
  @IsNumber()
  readonly receiverId: number;

  @IsNumber()
  readonly targetId: number;

  @IsNumber()
  readonly type: number;
}

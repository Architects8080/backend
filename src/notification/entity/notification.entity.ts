import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../user/entity/user.entity';

export enum NotificationType {
  FRIEND,
  CHANNEL,
}

@Entity('notification')
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  senderId: number;

  @Column()
  receiverId: number;

  //채널 초대: roomId
  //친구 요청: senderId
  @Column()
  targetId: number;

  @Column() //0: 친구초대 1: 채팅초대
  type: NotificationType;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'senderID' })
  sender: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'receiverID' })
  receiver: User;
}

import { User } from 'src/user/entity/user.entity';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { ChannelMessage } from './channel-message.entity';
import { Channel } from './channel.entity';

export enum MemberRole {
  MEMBER = 'member',
  ADMIN = 'admin',
  OWNER = 'owner',
}

@Entity('channel_member')
@Unique(['channelId', 'userId'])
export class ChannelMember {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Channel, (channel) => channel.memberList, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'channelId' })
  channel: Channel;
  @Column()
  channelId: number;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  })
  @JoinColumn({ name: 'userId' })
  user: User;
  @Column()
  userId: number;

  @Column({
    type: 'enum',
    default: MemberRole.MEMBER,
    enum: MemberRole,
  })
  role: MemberRole;
}

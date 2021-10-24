import { User } from 'src/user/entity/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ChannelMember } from './channel-member.entity';
import { Channel } from './channel.entity';

@Entity('channel_message')
export class ChannelMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Channel, (channel) => channel.messageList, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'channelId' })
  channel: Channel;
  @Column()
  channelId: number;

  @ManyToOne(() => ChannelMember, {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([
    { name: 'userId', referencedColumnName: 'userId' },
    { name: 'cid', referencedColumnName: 'channelId' },
  ])
  sender: ChannelMember;
  @Column({ nullable: true })
  userId: number;
  @Column({ nullable: true })
  cid: number;

  @Column()
  message: string;

  @CreateDateColumn()
  timestamp: Date;
}

import { User } from 'src/user/entity/user.entity';
import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

@Entity('friend')
export class Friend {
  @PrimaryColumn()
  userId: number;

  @PrimaryColumn()
  otherId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => User, (other) => other.friendList)
  @JoinColumn({ name: 'otherId' })
  other: User;
}

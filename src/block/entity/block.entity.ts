import { User } from 'src/user/entity/user.entity';
import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

@Entity('block')
export class Block {
  @PrimaryColumn()
  userId: number;

  @PrimaryColumn()
  otherId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => User, (other) => other.blockList)
  @JoinColumn({ name: 'otherId' })
  other: User;
}

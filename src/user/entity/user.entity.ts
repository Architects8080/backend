import { Exclude, Transform, TransformFnParams } from 'class-transformer';
import { configuration } from 'config/configuration';
import { Block } from 'src/block/entity/block.entity';
import { Friend } from 'src/friend/entity/friend.entity';
import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';

@Entity('user')
export class User {
  @PrimaryColumn()
  id: number;

  @Column({ nullable: false, unique: true, length: 255 })
  nickname: string;

  @Column({ nullable: false, unique: true, length: 255 })
  intraLogin: string;

  @Column()
  @Transform((avatar: TransformFnParams) => {
    if (avatar.value == null) return '';
    if (!avatar.value.match('^https?://')) {
      const route = configuration.public.route;
      const avatarRoute = configuration.public.avatar.route;
      const serverAddress = configuration.server_address;
      return `${serverAddress}${route}${avatarRoute}/${avatar.value}`;
    }
    return avatar.value;
  })
  avatar: string;

  @Exclude()
  @Column({ nullable: true, default: null })
  otpSecret: string;

  @Column({ default: 0 })
  ladderPoint: number;

  @Column({ default: 0 })
  ladderLevel: number;

  @OneToMany(() => Friend, (rel) => rel.other)
  friendList: Friend[];

  @OneToMany(() => Block, (rel) => rel.other)
  blockList: Block[];
}

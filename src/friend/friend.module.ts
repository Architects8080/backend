import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockModule } from 'src/block/block.module';
import { Block } from 'src/block/entity/block.entity';
import { CommunityModule } from 'src/community/community.module';
import { NotificationModule } from 'src/notification/notification.module';
import { UserModule } from 'src/user/user.module';
import { Friend } from './entity/friend.entity';
import { FriendController } from './friend.controller';
import { FriendService } from './friend.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Friend, Block]),
    forwardRef(() => NotificationModule),
    UserModule,
    forwardRef(() => BlockModule),
    forwardRef(() => CommunityModule),
  ],
  controllers: [FriendController],
  providers: [FriendService],
  exports: [FriendService],
})
export class FriendModule {}

import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { DmModule } from 'src/dm/dm.module';
import { DirectMessageInfo } from 'src/dm/entity/dm.entity';
import { FriendModule } from 'src/friend/friend.module';
import { NotificationModule } from 'src/notification/notification.module';
import { User } from 'src/user/entity/user.entity';
import { UserModule } from 'src/user/user.module';
import { CommunityGateway } from './community.gateway';
import { CommunitySocketUserService } from './community.socket-user.service';
import { StatusService } from './status.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, DirectMessageInfo]),
    AuthModule,
    DmModule,
    forwardRef(() => FriendModule),
    forwardRef(() => NotificationModule),
    UserModule,
  ],
  providers: [CommunityGateway, CommunitySocketUserService, StatusService],
  exports: [CommunitySocketUserService, CommunityGateway, StatusService],
})
export class CommunityModule {}

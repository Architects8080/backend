import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { StatusModule } from 'src/community/status/status.module';
import { NotificationEventModule } from 'src/notification/event/notification-event.module';
import { UserModule } from 'src/user/user.module';
import { ChannelEventService } from './channel-event.service';
import { ChannelRoleService } from './channel-role.service';
import { ChannelController } from './channel.controller';
import { ChannelGateway } from './channel.gateway';
import { ChannelService } from './channel.service';
import { ChannelSocketUserService } from './channel.socket-user.service';
import { ChannelMember } from './entity/channel-member.entity';
import { ChannelMessage } from './entity/channel-message.entity';
import { ChannelPenalty } from './entity/channel-penalty.entity';
import { Channel } from './entity/channel.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Channel,
      ChannelMember,
      ChannelPenalty,
      ChannelMessage,
    ]),
    AuthModule,
    UserModule,
    NotificationEventModule,
    StatusModule,
  ],
  controllers: [ChannelController],
  providers: [
    ChannelService,
    ChannelGateway,
    ChannelSocketUserService,
    ChannelRoleService,
    ChannelEventService,
  ],
  exports: [ChannelService],
})
export class ChannelModule {}

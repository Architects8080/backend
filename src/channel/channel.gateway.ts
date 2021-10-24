import { Inject, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { serialize } from 'class-transformer';
import { validate, Validator } from 'class-validator';
import { Server } from 'socket.io';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { cookieExtractor, JwtStrategy } from 'src/auth/strategy/jwt.strategy';
import { UserStatus } from 'src/community/data/user-status';
import { StatusService } from 'src/community/status/status.service';
import { SocketUser } from 'src/socket/socket-user';
import { SocketUserService } from 'src/socket/socket-user.service';
import { ChannelEventService } from './channel-event.service';
import { ChannelService } from './channel.service';
import { CHANNEL_SOCKET_USER_SERVICE_PROVIDER } from './channel.socket-user.service';
import { ChannelMessageDto } from './dto/channel-message.dto';

@UseGuards(JwtAuthGuard)
@WebSocketGateway(4501, { namespace: 'channel' })
export class ChannelGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  constructor(
    private jwtService: JwtService,
    private jwtStrategy: JwtStrategy,
    private channelService: ChannelService,
    @Inject(CHANNEL_SOCKET_USER_SERVICE_PROVIDER)
    private socketUserService: SocketUserService,
    private channelEventService: ChannelEventService,
    private statusService: StatusService,
  ) {}

  @WebSocketServer() server: Server;

  afterInit(server: any) {
    this.channelEventService.server = this.server;
    this.statusService.addListener(async (id: number, status: UserStatus) => {
      const channelMemberList =
        await this.channelService.getChannelMemberListByUser(id);
      channelMemberList.forEach((cm) => {
        this.channelEventService.updateChannelMember(cm.channelId, cm);
      });
    });
  }

  async handleConnection(client: SocketUser) {
    console.log(`Client ${client.id} Connected to channel`);
    try {
      const token = cookieExtractor(client);
      const userPayload = this.jwtService.verify(token);
      const user = await this.jwtStrategy.validate(userPayload);
      client.user = user;
      this.socketUserService.addSocket(client);
    } catch (error) {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: SocketUser) {
    console.log(`Client ${client.id} Disconnected`);
    try {
      const token = cookieExtractor(client);
      const userPayload = this.jwtService.verify(token);
      const user = await this.jwtStrategy.validate(userPayload);
      client.user = user;
      this.socketUserService.removeSocket(client);
    } catch (error) {}
  }

  @SubscribeMessage('subscribeChannel')
  async subscribeChannel(
    @ConnectedSocket() client: SocketUser,
    @MessageBody() channelId: number,
  ) {
    if (this.channelService.isJoinChannel(client.user.id, channelId))
      client.join(`channel:${channelId}`);
  }

  @SubscribeMessage('unsubscribeChannel')
  async unsubscribeChannel(
    @ConnectedSocket() client: SocketUser,
    @MessageBody() channelId: number,
  ) {
    client.leave(`channel:${channelId}`);
  }

  @SubscribeMessage('messageToServer')
  async receiveMessage(
    @ConnectedSocket() client: SocketUser,
    @MessageBody() dto: ChannelMessageDto,
  ) {
    const validatorError = await validate(dto);
    if (validatorError.length > 0) return;
    let result = await this.channelService.createMessage(
      dto.channelId,
      client.user.id,
      dto.message,
    );
    result = JSON.parse(serialize(result));
    this.server.to(`channel:${dto.channelId}`).emit('messageToClient', result);
  }
}

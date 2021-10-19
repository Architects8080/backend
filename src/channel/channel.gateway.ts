import { forwardRef, Inject, ParseIntPipe, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { cookieExtractor, JwtStrategy } from 'src/auth/strategy/jwt.strategy';
import { SocketUser } from 'src/socket/socket-user';
import { SocketUserService } from 'src/socket/socket-user.service';
import { ChannelService } from './channel.service';
import { ChannelType } from './channel.type';
import { CreateChannelDto } from './dto/create-channel.dto';

@UseGuards(JwtAuthGuard)
@WebSocketGateway(4501, { namespace: 'channel' })
export class ChannelGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private jwtService: JwtService,
    private jwtStrategy: JwtStrategy,
    @Inject(forwardRef(() => ChannelService))
    private channelService: ChannelService,
    @Inject('CHANNEL_SOCKET_USER_SERVICE')
    private socketUserService: SocketUserService,
  ) {}
  @WebSocketServer() server: Server;

  async handleConnection(client: SocketUser) {
    try {
      const token = cookieExtractor(client);
      const userPayload = this.jwtService.verify(token);
      const user = await this.jwtStrategy.validate(userPayload);
      client.user = user;
      console.log(`Client ${client.user.nickname} Connected to channel`);
      console.log(client.rooms);
      console.log(user.id, user.intraLogin);
      this.socketUserService.addSocket(client);
    } catch (error) {
      console.log(error);
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: SocketUser) {
    try {
      const token = cookieExtractor(client);
      const userPayload = this.jwtService.verify(token);
      const user = await this.jwtStrategy.validate(userPayload);
      client.user = user;
    console.log(`Client ${client.user.nickname} Disconnected`);
    this.socketUserService.removeSocket(client);
    } catch (error) {}
  }

  @SubscribeMessage('joinChannel')
  async joinChannel(
    @MessageBody(new ParseIntPipe()) roomId: any,
    @ConnectedSocket() client: SocketUser,
  ) {
    const channel = await this.channelService.getChannelById(roomId);
    if (channel.type > ChannelType.PUBLIC) {
      //RoomType is Protected or Private
      const myChannel = await this.channelService.getMyChannel(client.user.id);
      if (!myChannel.find((myChannel) => myChannel.roomId == roomId)) {
        client.emit('joinRefused');
        return ;
      }
    }
    //RoomType is Public or Protected/Private & accepted case.
    client.join(roomId);
    this.channelService.joinChannel(roomId, client.user);
  }

  @SubscribeMessage('leaveChannel')
  leaveChannel(
    @MessageBody() data: any,
    @ConnectedSocket() client: SocketUser,
  ) {
    this.channelService.leaveChannel(data, client.user.id);
    this.server.to(data).emit('channelMemberRemove', client.user.id);
  }

  @SubscribeMessage('msgToChannel')
  handleMessage(
    @MessageBody() data: any,
    @ConnectedSocket() client: SocketUser,
  ) {
    const payload = {
      text: data.text,
      name: client.user.nickname,
    };
    this.server.to(data.roomId).emit('msgToClient', payload);
  }
}

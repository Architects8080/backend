import { JwtService } from '@nestjs/jwt';
import { cookieExtractor, JwtStrategy } from 'src/auth/strategy/jwt.strategy';
import { Inject, Logger, UseGuards } from '@nestjs/common';
import {
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { SocketUser } from 'src/socket/socket-user';
import { SendDMDto } from 'src/dm/dto/sendDM';
import { DmService } from 'src/dm/dm.service';
import { SocketUserService } from 'src/socket/socket-user.service';
import { FriendService } from 'src/friend/friend.service';
import { UserStatus } from './data/user-status';
import { StatusService } from './status/status.service';
import { COMMUNITY_SOCKET_USER_SERVICE_PROVIDER } from './socket-user/community.socket-user.service';
import { CommunityEventService } from './event/community-event.service';

@UseGuards(JwtAuthGuard)
@WebSocketGateway(4500, { namespace: 'community' })
export class CommunityGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  constructor(
    private jwtService: JwtService,
    private jwtStrategy: JwtStrategy,
    private dmService: DmService,
    @Inject(COMMUNITY_SOCKET_USER_SERVICE_PROVIDER)
    private socketUserService: SocketUserService,
    private statusService: StatusService,
    private friendService: FriendService,
    private communityEventService: CommunityEventService,
  ) {}

  @WebSocketServer() server: Server;

  afterInit(server: any) {
    this.statusService.listenerList.push((id: number, status: UserStatus) => {
      console.log(id);
      this.server
        .to(`user:${id.toString()}`)
        .emit('changeUserStatus', id, status);
    });
    this.communityEventService.server = this.server;
  }

  private logger: Logger = new Logger('CommunityGateway');

  async handleConnection(client: SocketUser) {
    this.logger.log(`[connected] ${client.id}`);
    try {
      const token = cookieExtractor(client);
      const userPayload = this.jwtService.verify(token);
      const user = await this.jwtStrategy.validate(userPayload);
      client.user = user;
      this.socketUserService.addSocket(client);
      const friendList = await this.friendService.getFriendList(user.id);
      friendList.forEach((friend) => {
        client.join(`user:${friend.id.toString()}`);
      });
      if (this.statusService.getUserStatusById(user.id) != UserStatus.PLAYING)
        this.statusService.setUserStatusById(user.id, UserStatus.ONLINE);
    } catch (error) {
      console.log(error);
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: SocketUser) {
    this.logger.log(`[disconnected] ${client.id}`);
    try {
      const token = cookieExtractor(client);
      const userPayload = this.jwtService.verify(token);
      const user = await this.jwtStrategy.validate(userPayload);
      client.user = user;
      this.socketUserService.removeSocket(client);
      if (this.statusService.getUserStatusById(user.id) != UserStatus.PLAYING)
        this.statusService.setUserStatusById(user.id, UserStatus.OFFLINE);
    } catch (error) {}
  }

  @SubscribeMessage('dmToServer')
  async handleMessage(@MessageBody() dm: SendDMDto) {
    this.dmService.sendDM(dm);
    const newDM = { id: dm.userID, message: dm.message };
    const user = await this.socketUserService.getSocketById(dm.userID);
    const friend = await this.socketUserService.getSocketById(dm.friendID);
    if (user) user.emit('dmToClient', newDM);
    if (friend) friend.emit('dmToClient', newDM);
  }
}

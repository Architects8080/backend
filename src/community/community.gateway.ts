import { JwtService } from '@nestjs/jwt';
import { cookieExtractor, JwtStrategy } from 'src/auth/strategy/jwt.strategy';
import { forwardRef, Inject, Logger, UseGuards } from '@nestjs/common';
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
import { SocketUser } from 'src/socket/socket-user';
import { SendDMDto } from 'src/dm/dto/sendDM';
import { DmService } from 'src/dm/dm.service';
import { SocketUserService } from 'src/socket/socket-user.service';
import { FriendService } from 'src/friend/friend.service';
import { StatusService } from './status.service';
import { UserStatus } from './data/user-status';
import { COMMUNITY_SOCKET_USER_SERVICE_PROVIDER } from './community.socket-user.service';
import { Notification } from 'src/notification/entity/notification.entity';
import { UserService } from 'src/user/user.service';

@UseGuards(JwtAuthGuard)
@WebSocketGateway(4500, { namespace: 'community' })
export class CommunityGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private jwtService: JwtService,
    private jwtStrategy: JwtStrategy,
    private dmService: DmService,
    @Inject(COMMUNITY_SOCKET_USER_SERVICE_PROVIDER)
    private socketUserService: SocketUserService,
    @Inject(forwardRef(() => StatusService))
    private statusService: StatusService,
    private friendService: FriendService,
    private userService: UserService,
  ) {}
  @WebSocketServer() server: Server;
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

  async notify(receiverId: number, notification: Notification) {
    const client = this.socketUserService.getSocketById(receiverId);
    if (!client) return;
    client.emit('notificationReceive', notification);
  }

  async addFriendUser(receiverId: number, friendId: number) {
    const client = this.socketUserService.getSocketById(receiverId);
    if (!client) return;
    try {
      const friend = await this.userService.getUserById(friendId);
      const friendStatus = this.statusService.getUserStatusById(friendId);
      client.emit('addFriendUser', { status: friendStatus, ...friend });
      client.join(`user:${friendId.toString()}`);
    } catch (error) {}
  }

  async removeFriendUser(receiverId: number, friendId: number) {
    const client = this.socketUserService.getSocketById(receiverId);
    if (!client) return;
    client.leave(`user:${friendId.toString()}`);
    client.emit('removeFriendUser', friendId);
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { mergeUserAndStatus } from 'src/community/data/status-user';
import { StatusService } from 'src/community/status/status.service';
import { SocketUserService } from 'src/socket/socket-user.service';
import { CHANNEL_SOCKET_USER_SERVICE_PROVIDER } from './channel.socket-user.service';
import { CountChannel } from './data/count-channel.data';
import { ChannelMember } from './entity/channel-member.entity';

@Injectable()
export class ChannelEventService {
  constructor(
    @Inject(CHANNEL_SOCKET_USER_SERVICE_PROVIDER)
    private socketUserService: SocketUserService,
    private statusService: StatusService,
  ) {}

  server: Server;

  toChannelRoom(channelId: number) {
    return this.server.to(`channel:${channelId}`);
  }

  addChannelMember(channelId: number, member: ChannelMember) {
    member.user = mergeUserAndStatus(
      member.user,
      this.statusService.getUserStatusById(member.userId),
    );
    this.toChannelRoom(channelId).emit('addChannelMember', channelId, member);
  }

  removeChannelMember(channelId: number, userId: number) {
    this.toChannelRoom(channelId).emit(
      'removeChannelMember',
      channelId,
      userId,
    );
  }

  updateChannelMember(channelId: number, member: ChannelMember) {
    member.user = mergeUserAndStatus(
      member.user,
      this.statusService.getUserStatusById(member.userId),
    );
    this.toChannelRoom(channelId).emit(
      'updateChannelMember',
      channelId,
      member,
    );
  }

  muteMember(channelId: number, memberId: number, expired: Date) {
    const memberSocket = this.socketUserService.getSocketById(memberId);
    if (memberSocket) memberSocket.emit('muteMember', channelId, expired);
  }

  unmuteMember(channelId: number, memberId: number) {
    const memberSocket = this.socketUserService.getSocketById(memberId);
    if (memberSocket) memberSocket.emit('unmuteMember', channelId);
  }

  updateChannel(channel: CountChannel) {
    this.server.emit('updateChannel', channel);
  }

  deleteChannel(channelId: number) {
    this.server.emit('deleteChannel', channelId);
  }

  addChannelList(channel: CountChannel) {
    this.server.emit('addChannel', channel);
  }

  removeChannelList(channelId: number) {
    this.server.emit('removeChannel', channelId);
  }

  addMyChannel(userId: number, channel: CountChannel) {
    const socket = this.socketUserService.getSocketById(userId);
    if (socket) socket.emit('addMyChannel', channel);
  }

  removeMyChannel(userId: number, channelId: number) {
    const socket = this.socketUserService.getSocketById(userId);
    if (socket) socket.emit('removeMyChannel', channelId);
  }
}

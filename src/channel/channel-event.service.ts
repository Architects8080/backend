import { Inject, Injectable } from '@nestjs/common';
import { serialize } from 'class-transformer';
import { Server } from 'socket.io';
import { mergeUserAndStatus } from 'src/community/data/status-user';
import { StatusService } from 'src/community/status/status.service';
import { SocketUserService } from 'src/socket/socket-user.service';
import { CHANNEL_SOCKET_USER_SERVICE_PROVIDER } from './channel.socket-user.service';
import { CountChannel } from './data/count-channel.data';
import { ChannelMember } from './entity/channel-member.entity';
import { ChannelType } from './entity/channel.entity';

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
    this.toChannelRoom(channelId).emit(
      'addChannelMember',
      channelId,
      JSON.parse(serialize(member)),
    );
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
      JSON.parse(serialize(member)),
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

  updateChannel(channel: CountChannel, memberList?: ChannelMember[]) {
    if (channel.type == ChannelType.PRIVATE && memberList) {
      memberList.forEach((member) => {
        const memberSocket = this.socketUserService.getSocketById(
          member.userId,
        );
        if (memberSocket)
          memberSocket.emit('updateChannel', JSON.parse(serialize(channel)));
      });
    } else this.server.emit('updateChannel', JSON.parse(serialize(channel)));
  }

  deleteChannel(channelId: number) {
    this.server.emit('deleteChannel', channelId);
  }

  addChannelList(channel: CountChannel) {
    this.server.emit('addChannel', JSON.parse(serialize(channel)));
  }

  removeChannelList(channelId: number) {
    this.server.emit('removeChannel', channelId);
  }

  addMyChannel(userId: number, channel: CountChannel) {
    const socket = this.socketUserService.getSocketById(userId);
    if (socket) socket.emit('addMyChannel', JSON.parse(serialize(channel)));
  }

  removeMyChannel(userId: number, channelId: number) {
    const socket = this.socketUserService.getSocketById(userId);
    if (socket) socket.emit('removeMyChannel', channelId);
  }

  leaveChannel(channelId: number, userId: number) {
    const socket = this.socketUserService.getSocketById(userId);
    if (socket) socket.leave(`channel:${channelId}`);
  }
}

import { forwardRef, HttpException, HttpStatus,  Inject,  Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChannelListDto } from './dto/channel-list.dto';
import { CreateChannelDto } from './dto/create-channel.dto';
import { Channel, ChannelMember } from './entity/channel.entity';
import * as bcrypt from 'bcrypt';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { ChannelType, Invite, Penalty, Permission } from './channel.type';
import { UserService } from 'src/user/user.service';
import { ChannelGateway } from './channel.gateway';
import { User } from 'src/user/entity/user.entity';
import { NotificationService } from 'src/notification/notification.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { NotificationType } from 'src/notification/entity/notification.entity';

@Injectable()
export class ChannelService {
  constructor(
    @InjectRepository(Channel)
    private readonly channelRepository: Repository<Channel>,
    @InjectRepository(ChannelMember)
    private channelMemberRepository: Repository<ChannelMember>,
    @Inject(forwardRef(() => ChannelGateway))
    private channelGateway: ChannelGateway,
    @Inject(forwardRef(() => NotificationService))
    private readonly notificationService: NotificationService,
    private readonly userService: UserService,
  ) {}

  async onModuleInit() {
    console.log(`test`);
    this.channelGateway.update();
  }

  private getChannelItemList(channelList: Channel[]) {
    return channelList.map((channel) => {
      const channelItem = new ChannelListDto();
      
      channelItem.roomId = channel.id;
      channelItem.title = channel.title;
      channelItem.type = channel.type;
      channelItem.memberCount = channel.memberList.length;
      return (channelItem);
    })
  }

  private getChannelItem(channel: Channel) {
    const channelItem = new ChannelListDto();
    
    channelItem.roomId = channel.id;
    channelItem.title = channel.title;
    channelItem.type = channel.type;
    channelItem.memberCount = channel.memberList.length;
    return (channelItem);
  }

  async getAllChannel() {
    const channelList = await this.channelRepository.find({
      relations: ['memberList'],
    });
    return this.getChannelItemList(channelList);
  }

  async getChannelById(id: number) {
    const channel = await this.channelRepository.findOne({
      where: {id: id},
      relations: ['memberList'],
    });
    return this.getChannelItem(channel);
  }

  async getMyChannel(userId: number) {
    const joinChannelList = [];
    const joinChannelIDList = await this.channelMemberRepository.find({
      select: ['channel'],
      where: {
        userID: userId,
      },
    });

    for (const channel of joinChannelIDList) {
      joinChannelList.push(
        await this.channelRepository.findOne({
          where: {id: channel.channelID},
          relations: ['memberList']}
        )
      );
    }
    return (this.getChannelItemList(joinChannelList));
  }

  async getChannelMember(roomId: number) {
    const channelMemberList = await this.channelMemberRepository.find({
      select: ['user'],
      where: {
        channelID: roomId,
      },
      join: {
        alias: 'channel_member',
        leftJoinAndSelect: {
          user: 'channel_member.user',
        },
      },
    });

    return channelMemberList.map((member) => {
      return ({
        id: member.user.id,
        avatar: member.user.avatar,
        nickname: member.user.nickname,
      });
    });
  }

  async createChannel(channelData: CreateChannelDto) {
    const newChannel: Channel = this.channelRepository.create();
    newChannel.title = channelData.title;
    newChannel.type = channelData.type,
    newChannel.password = channelData.password,
    await this.channelRepository.insert(newChannel);

    const owner: ChannelMember = this.channelMemberRepository.create();
    const newChannelId = await this.channelRepository.findOne({
      select: ['id'],
      order: {
        id: 'DESC',
      },
    });

    owner.userID = channelData.ownerId;
    owner.channelID = newChannelId.id;
    owner.permissionType = Permission.OWNER;
    owner.penalty = Penalty.NONE;
    await this.channelMemberRepository.insert(owner);

    this.channelGateway.update();
    return owner.channelID;
  }

  async joinChannel(roomId: number, user: User) {
    const newMember = {
      id: user.id,
      nickname: user.nickname,
      avatar: user.avatar,
    };

    const myChannel = await this.getMyChannel(user.id);
    const isJoinedChannel = myChannel.find((myChannel) => myChannel.roomId == roomId);

    if (!isJoinedChannel) {
      // add client to new channel
      const newChannelMember: ChannelMember = this.channelMemberRepository.create();
      newChannelMember.userID = user.id;
      newChannelMember.channelID = roomId;
      newChannelMember.permissionType = Permission.MEMBER;
      newChannelMember.penalty = Penalty.NONE;
      await this.channelMemberRepository.insert(newChannelMember);

      this.channelGateway.server.to(roomId.toString()).emit('channelMemberAdd', newMember);
    } else if (isJoinedChannel.type > ChannelType.PUBLIC){
      //update to private room member
      this.channelGateway.server.to(roomId.toString()).emit('channelMemberAdd', newMember);
    }
    this.channelGateway.update();
  }

  async checkPassword(userId: number, roomId: number, password: string) {
    try {
      const hashedpw = await this.channelRepository.findOne({
        where: {
          id: roomId,
        },
      });
      const isPasswordMatched = await bcrypt.compare(
        password,
        hashedpw.password,
      );

      if (isPasswordMatched) {
        const newChannelMember: ChannelMember = this.channelMemberRepository.create();
        newChannelMember.userID = userId;
        newChannelMember.channelID = roomId;
        newChannelMember.permissionType = Permission.MEMBER;
        newChannelMember.penalty = Penalty.NONE;
        await this.channelMemberRepository.insert(newChannelMember);
      }
      return isPasswordMatched;
    } catch (error) {
      throw new HttpException(
        'Wrong credentials provided',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async leaveChannel(roomId: number, userId: number) {
    await this.channelMemberRepository.delete({
      userID: userId,
      channelID: roomId,
    });
    const memberCount = await this.channelMemberRepository.count({
      where: {
        channelID: roomId,
      },
    });
    if (memberCount == 0)
      await this.channelRepository.delete({ id: roomId });
    this.channelGateway.update();
  }

  async updateChannel(roomId: number, updateData: UpdateChannelDto) {
    const updateChannel = await this.channelRepository.findOne(roomId);
    for (const key in updateData) {
      updateChannel[key] = updateData[key];
    }
    await this.channelRepository.save(updateChannel);
    this.channelGateway.update();
  }

  async inviteMember(roomId: number, inviteData: InviteMemberDto) {
    var resultCode = Invite.NONE;
    try {
      const invitedUser = await this.userService.getUserByNickname(inviteData.nickname);
      const memberList = await this.getChannelMember(roomId);
      resultCode = Invite.SUCCESS;
      memberList.map(member => {
        if (member.id == invitedUser.id) {
          resultCode = Invite.ALREADY_JOINED;
        }
      });

      if (resultCode == Invite.SUCCESS) {
        await this.notificationService.setNotification(
          inviteData.userId,
          {
            receiverId: invitedUser.id,
            targetId: roomId,
            type: NotificationType.CHANNEL,
          },
        );
      }
    } catch (e) {
      resultCode = Invite.NOT_FOUND_USER;
    }
    return resultCode;
  }
}

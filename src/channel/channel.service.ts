import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CountChannel, mergeChannelAndCount } from './data/count-channel.data';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { ChannelMember, MemberRole } from './entity/channel-member.entity';
import {
  ChannelPenalty,
  ChannelPenaltyType,
} from './entity/channel-penalty.entity';
import { Channel, ChannelType } from './entity/channel.entity';
import * as bcrypt from 'bcrypt';
import { NotificationEventService } from 'src/notification/event/notification-event.service';
import { NotificationType } from 'src/notification/entity/notification.entity';
import { UserService } from 'src/user/user.service';
import { ChannelMessage } from './entity/channel-message.entity';
import { ChannelEventService } from './channel-event.service';
import { StatusService } from 'src/community/status/status.service';
import { mergeUserAndStatus } from 'src/community/data/status-user';

@Injectable()
export class ChannelService {
  constructor(
    @InjectRepository(Channel)
    private channelRepository: Repository<Channel>,
    @InjectRepository(ChannelMember)
    private channelMemberRepository: Repository<ChannelMember>,
    @InjectRepository(ChannelPenalty)
    private channelPenaltyRepository: Repository<ChannelPenalty>,
    @InjectRepository(ChannelMessage)
    private channelMessageRepository: Repository<ChannelMessage>,
    private notificationEventService: NotificationEventService,
    private userService: UserService,
    private statusService: StatusService,
    private readonly channelEventService: ChannelEventService,
  ) {}

  async channelToCountChannel(channel: Channel) {
    const count = await this.channelMemberRepository.count({
      where: {
        channelId: channel.id,
      },
    });
    return mergeChannelAndCount(channel, count);
  }

  async getChannelList() {
    const channelList = await this.channelRepository.find({
      where: {
        type: In([ChannelType.PUBLIC, ChannelType.PROTECTED]),
      },
    });
    return await Promise.all(
      channelList.map((ch) => {
        return this.channelToCountChannel(ch);
      }),
    );
  }

  async getChannelMemberListByUser(userId: number) {
    const channelMemberList = await this.channelMemberRepository.find({
      relations: ['user'],
      where: {
        userId: userId,
      },
    });

    return channelMemberList;
  }

  async getChannelListByUser(userId: number) {
    const channelMemberList = await this.channelMemberRepository.find({
      select: ['channel'],
      relations: ['channel'],
      where: {
        userId: userId,
      },
    });
    return await Promise.all(
      channelMemberList.map((cm) => {
        return this.channelToCountChannel(cm.channel);
      }),
    );
  }

  async createChannel(userId: number, channelDto: CreateChannelDto) {
    const channelData = this.channelRepository.create(channelDto);
    if (channelDto.type != ChannelType.PROTECTED) channelData.password = null;
    const channelResult = await this.channelRepository.insert(channelData);
    const channelId: number = Number(channelResult.identifiers[0].id);
    channelData.id = channelId;
    await this.channelMemberRepository.insert({
      channelId: channelId,
      userId: userId,
      role: MemberRole.OWNER,
    });
    const countChannel = await this.channelToCountChannel(channelData);
    if (channelDto.type != ChannelType.PRIVATE)
      this.channelEventService.addChannelList(countChannel);
    this.channelEventService.addMyChannel(userId, countChannel);
    return { channelId: channelId };
  }

  async deleteChannel(channelId: number) {
    await this.channelRepository.delete(channelId);
    this.channelEventService.deleteChannel(channelId);
  }

  async updateChannel(channelId: number, dto: UpdateChannelDto) {
    const channel = await this.channelRepository.findOneOrFail(channelId);
    const isTypeChanged = dto.type && channel.type != dto.type;
    if (dto.type) {
      if (dto.type != ChannelType.PROTECTED) dto.password = null;
    } else {
      if (channel.type != ChannelType.PROTECTED) dto.password = null;
    }
    for (const key in dto) {
      channel[key] = dto[key];
    }
    await this.channelRepository.save(channel);
    const countChannel = await this.channelToCountChannel(channel);
    if (isTypeChanged) {
      if (channel.type == ChannelType.PRIVATE)
        this.channelEventService.removeChannelList(channelId);
      else this.channelEventService.addChannelList(countChannel);
    }
    this.emitUpdateChannel(countChannel);
  }

  async isJoinChannel(memberId: number, channelId: number) {
    try {
      await this.channelMemberRepository.findOneOrFail({
        where: {
          userId: memberId,
          channelId: channelId,
        },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  async getChannelMemberList(channelId: number) {
    const channel = await this.channelRepository
      .createQueryBuilder('channel')
      .where(`channel.id=${channelId}`)
      .leftJoinAndSelect('channel.memberList', 'memberList')
      .leftJoinAndSelect('memberList.user', 'user')
      .orderBy({
        'memberList.role': 'DESC',
        'user.nickname': 'ASC',
      })
      .getOne();
    return channel.memberList.map((member) => {
      member.user = mergeUserAndStatus(
        member.user,
        this.statusService.getUserStatusById(member.userId),
      );
      return member;
    });
  }

  async getCountChannelById(channelId: number) {
    return await this.channelToCountChannel(
      await this.channelRepository.findOneOrFail(channelId),
    );
  }

  async emitUpdateChannel(channel: CountChannel) {
    let memberList;
    try {
      memberList = await this.channelMemberRepository.find({
        where: {
          channelId: channel.id,
        },
      });
    } catch (error) {}
    this.channelEventService.updateChannel(channel, memberList);
  }

  async emitJoinMember(userId: number, channelId: number) {
    try {
      const countChannel = await this.getCountChannelById(channelId);

      this.emitUpdateChannel(countChannel);
      this.channelEventService.addMyChannel(userId, countChannel);
      const newMember = await this.channelMemberRepository.findOne({
        relations: ['user'],
        where: {
          userId: userId,
          channelId: channelId,
        },
      });
      this.channelEventService.addChannelMember(channelId, newMember);
    } catch (error) {}
  }

  async emitLeaveMember(userId: number, channelId: number) {
    try {
      const countChannel = await this.getCountChannelById(channelId);

      this.emitUpdateChannel(countChannel);
      this.channelEventService.removeMyChannel(userId, channelId);
      this.channelEventService.removeChannelMember(channelId, userId);
    } catch (error) {
      console.log(error);
    }
  }

  async emitUpdateChannelMember(channelId: number, userId: number) {
    try {
      const member = await this.channelMemberRepository.findOne({
        where: {
          userId: userId,
          channelId: channelId,
        },
      });
      this.channelEventService.updateChannelMember(channelId, member);
    } catch (error) {}
  }

  async acceptChannelInvitation(userId: number, channelId: number) {
    if (await this.isJoinChannel(userId, channelId))
      throw new ConflictException();
    if (await this.isBanMember(channelId, userId))
      throw new ForbiddenException();
    try {
      await this.channelMemberRepository.insert({
        userId: userId,
        channelId: channelId,
      });
    } catch (error) {
      switch (error.code) {
        case '23505':
          throw new ConflictException();
        case '23503':
          throw new NotFoundException();
        default:
          throw new BadRequestException();
      }
    }
    this.emitJoinMember(userId, channelId);
  }

  async joinChannel(userId: number, channelId: number, password?: string) {
    if (await this.isJoinChannel(userId, channelId))
      throw new ConflictException();
    if (await this.isBanMember(channelId, userId))
      throw new ForbiddenException();
    const channel = await this.channelRepository.findOne(channelId);
    if (!channel || channel.type == ChannelType.PRIVATE)
      throw new NotFoundException();
    if (channel.type == ChannelType.PROTECTED) {
      if (
        !password ||
        password.length != 4 ||
        !password.match('^[0-9]+$') ||
        !(await bcrypt.compare(password, channel.password))
      )
        throw new ForbiddenException();
    }
    try {
      await this.channelMemberRepository.insert({
        userId: userId,
        channelId: channelId,
      });
    } catch (error) {
      switch (error.code) {
        case '23505':
          throw new ConflictException();
        case '23503':
          throw new NotFoundException();
        default:
          throw new BadRequestException();
      }
    }
    this.emitJoinMember(userId, channelId);
  }

  async leaveChannel(userId: number, channelId: number) {
    const removeMember = await this.channelMemberRepository.findOneOrFail({
      userId: userId,
      channelId: channelId,
    });
    await this.channelMemberRepository.delete(removeMember);
    const channelMemberList = await this.getChannelMemberList(channelId);
    if (channelMemberList.length <= 0) {
      await this.deleteChannel(channelId);
      return;
    } else {
      if (removeMember.role == MemberRole.OWNER) {
        const newOwner: ChannelMember = channelMemberList[0];

        newOwner.role = MemberRole.OWNER;
        await this.channelMemberRepository.save(newOwner);
        this.emitUpdateChannelMember(channelId, userId);
      }
    }
    this.emitLeaveMember(userId, channelId);
  }

  async inviteUser(senderId: any, channelId: number, receiverId: number) {
    if (senderId == receiverId)
      throw new BadRequestException('Cannot invite yourself.');
    if (!(await this.userService.getUserById(receiverId)))
      throw new NotFoundException('Not found user');
    if (await this.isJoinChannel(receiverId, channelId))
      throw new ConflictException('Already channel member');
    const result = await this.notificationEventService.setNotification(
      senderId,
      {
        receiverId: receiverId,
        targetId: channelId,
        type: NotificationType.CHANNEL,
      },
    );
    if (!result) throw new ConflictException('Already invited');
  }

  async grantAdmin(channelId: number, memberId: number) {
    await this.channelMemberRepository.update(
      {
        channelId: channelId,
        userId: memberId,
      },
      {
        role: MemberRole.ADMIN,
      },
    );
    await this.emitUpdateChannelMember(channelId, memberId);
  }

  async revokeAdmin(channelId: number, memberId: number) {
    await this.channelMemberRepository.update(
      {
        channelId: channelId,
        userId: memberId,
      },
      {
        role: MemberRole.MEMBER,
      },
    );
    await this.emitUpdateChannelMember(channelId, memberId);
  }

  async getPenaltyMember(channelId: number, memberId: number) {
    const result = await this.channelPenaltyRepository.findOne({
      where: {
        channelId: channelId,
        userId: memberId,
      },
    });
    return result;
  }

  async isBanMember(channelId: number, memberId: number) {
    const result = await this.getPenaltyMember(channelId, memberId);
    if (result && result.type == ChannelPenaltyType.BAN) {
      if (result.expired < new Date()) {
        await this.channelPenaltyRepository.delete(result);
        return false;
      }
      return true;
    }
    return false;
  }

  async isMuteMember(channelId: number, memberId: number) {
    const result = await this.getPenaltyMember(channelId, memberId);
    if (result && result.type == ChannelPenaltyType.MUTE) {
      if (result.expired < new Date()) {
        await this.channelPenaltyRepository.delete(result);
        this.emitUnmuteMember(channelId, memberId);
        return false;
      }
      return true;
    }
    return false;
  }

  async emitMuteMember(channelId: number, memberId: number) {
    try {
      const penalty = await this.channelPenaltyRepository.findOneOrFail({
        channelId: channelId,
        userId: memberId,
      });
      this.channelEventService.muteMember(channelId, memberId, penalty.expired);
    } catch (error) {}
  }

  async emitUnmuteMember(channelId: number, memberId: number) {
    this.channelEventService.unmuteMember(channelId, memberId);
  }

  async muteMember(channelId: number, memberId: number) {
    const exist = await this.channelPenaltyRepository.findOne({
      where: {
        channelId: channelId,
        userId: memberId,
      },
    });
    if (exist && exist.type == ChannelPenaltyType.MUTE) {
      exist.expired = new Date();
      await this.channelPenaltyRepository.save(exist);
    } else {
      await this.channelPenaltyRepository.insert(
        this.channelPenaltyRepository.create({
          channelId: channelId,
          userId: memberId,
          type: ChannelPenaltyType.MUTE,
          expired: new Date(),
        }),
      );
    }
    this.emitMuteMember(channelId, memberId);
  }

  async banMember(channelId: number, memberId: number) {
    const exist = await this.channelPenaltyRepository.findOne({
      where: {
        channelId: channelId,
        userId: memberId,
      },
    });
    if (exist) {
      exist.expired = new Date();
      exist.type = ChannelPenaltyType.BAN;
      await this.channelPenaltyRepository.save(exist);
    } else {
      await this.channelPenaltyRepository.insert(
        this.channelPenaltyRepository.create({
          channelId: channelId,
          userId: memberId,
          type: ChannelPenaltyType.BAN,
        }),
      );
    }
    this.leaveChannel(memberId, channelId);
  }

  async getChannelMessageList(channelId: number) {
    const result = await this.channelMessageRepository.find({
      relations: ['sender', 'sender.user'],
      where: {
        channelId: channelId,
      },
    });
    return result.map((cm: any) => {
      if (cm.sender) cm.sender = cm.sender.user;
      return cm;
    });
  }

  async createMessage(channelId: number, memberId: number, message: string) {
    if (!(await this.isJoinChannel(memberId, channelId))) return;
    if (await this.isMuteMember(channelId, memberId)) return;
    const insertResult = await this.channelMessageRepository.insert({
      userId: memberId,
      cid: channelId,
      channelId: channelId,
      message: message,
    });
    const result: any = await this.channelMessageRepository.findOne({
      relations: ['sender', 'sender.user'],
      where: {
        id: insertResult.identifiers[0].id,
      },
    });
    if (result.sender) result.sender = result.sender.user;
    return result;
  }
}

import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChannelListDto } from './dto/channel-list.dto';
import { CreateChannelDto } from './dto/create-channel.dto';
import { Channel, ChannelMember } from './entity/channel.entity';
import * as bcrypt from 'bcrypt';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { Penalty, Permission } from './channel.type';
import { SocketUser } from 'src/socket/socket-user';
import { Server } from 'socket.io';

@Injectable()
export class ChannelService {
  constructor(
    @InjectRepository(Channel)
    private readonly channelRepository: Repository<Channel>,
    @InjectRepository(ChannelMember)
    private channelMemberRepository: Repository<ChannelMember>,
  ) {}

  channelMap: Map<number, ChannelListDto> = new Map();

  async onModuleInit() {
    await this.updateChannelMap();
  }

  async updateChannelMap() {
    const channels: Channel[] = await this.channelRepository.find();

    for (const channel of channels) {
      var toUpdateChannel = this.channelMap.get(channel.id);
      const memberCount = await this.channelMemberRepository.count({
        where: {
          channelID: channel.id,
        },
      });

      if (!toUpdateChannel) {
        const instance = new ChannelListDto();

        instance.roomId = channel.id;
        instance.title = channel.title;
        instance.isProtected = channel.type; //TODO : edit name
        instance.memberCount = memberCount;
        this.channelMap.set(instance.roomId, instance);
      }
      else if (toUpdateChannel.memberCount != memberCount) {
        //update memberCount
        this.channelMap.delete(channel.id);
        toUpdateChannel.memberCount = memberCount;
        this.channelMap.set(toUpdateChannel.roomId, toUpdateChannel);
      }
    }
  }

  async getAllChannel() {
    await this.updateChannelMap();
    return [...this.channelMap.values()];
  }

  async getMyChannel(userId: number) {
    const myChannel = [];
    const channels = await this.channelMemberRepository.find({
      select: ['channel'],
      where: {
        userID: userId,
      },
      join: {
        alias: 'channel_member',
        leftJoinAndSelect: {
          channel: 'channel_member.channel',
        },
      },
    });

    for (const channel of channels) {
      const instance = new ChannelListDto();
      const memberCount = await this.channelMemberRepository.count({
        where: {
          channelID: channel.channelID,
        },
      });

      instance.roomId = channel.channelID;
      instance.title = channel.channel.title;
      instance.isProtected = channel.channel.type;
      instance.memberCount = memberCount;
      myChannel.push(instance);
    }
    return myChannel;
  }

  async createChannel(channelData: CreateChannelDto) {

    // channel create
    const newChannel: Channel = this.channelRepository.create({
      title: channelData.title,
      type: channelData.type,
      password: channelData.password,
    });
    await this.channelRepository.insert(newChannel);

    // add create user to owner
    const owner: ChannelMember = this.channelMemberRepository.create();
    const newChannelId = await this.channelRepository.find({
      select: ['id'],
      order: {
        id: 'DESC',
      },
      take: 1,
    });
    owner.userID = channelData.ownerId;
    owner.channelID = newChannelId[0].id;
    owner.permissionType = Permission.OWNER;
    owner.penalty = Penalty.NONE;
    await this.channelMemberRepository.insert(owner);

    //update map
    await this.updateChannelMap();
    return owner.channelID;
  }

  // async createChannel(channelData: CreateChannelDto) {

  //   // channel create
  //   const newChannel: Channel = this.channelRepository.create({
  //     title: channelData.title,
  //     type: channelData.type,
  //     password: channelData.password,
  //   });
  //   await this.channelRepository.insert(newChannel);

  //   // add create user to owner
  //   const owner: ChannelMember = this.channelMemberRepository.create();
  //   const newChannelId = await this.channelRepository.find({
  //     select: ['id'],
  //     order: {
  //       id: 'DESC',
  //     },
  //     take: 1,
  //   });
  //   owner.userID = channelData.ownerId;
  //   owner.channelID = newChannelId[0].id;
  //   owner.permissionType = Permission.OWNER;
  //   owner.penalty = Penalty.NONE;
  //   await this.channelMemberRepository.insert(owner);

  //   //update map
  //   await this.updateChannelMap();
  //   return owner.channelID;
  // }

  async joinChannel(roomId: number, client: SocketUser, server: Server) {
    client.join(roomId.toString());
    const newMember = {
      id: client.user.id,
      nickname: client.user.nickname.toString(),
      avatar: client.user.avatar.toString(),
      status: client.user.status,
    };

    const myChannel = await this.getMyChannel(client.user.id);
    const isJoinedChannel = myChannel.find((myChannel) => myChannel.roomId == roomId);

    if (!isJoinedChannel) {
      // add client to new channel
      const newChannelMember: ChannelMember = this.channelMemberRepository.create();
      newChannelMember.userID = client.user.id;
      newChannelMember.channelID = roomId;
      newChannelMember.permissionType = Permission.MEMBER;
      newChannelMember.penalty = Penalty.NONE;
      await this.channelMemberRepository.insert(newChannelMember);

      server.to(roomId.toString()).emit('channelMemberAdd', newMember);
    } else if (isJoinedChannel.isProtected > 0){
      //update to private room member
      server.to(roomId.toString()).emit('channelMemberAdd', newMember);
    }
    await this.updateChannelMap();
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

      //is Password Matched, add client to chatroom
      if (isPasswordMatched) {
        console.log(`password accepted!!`);
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
    if (memberCount == 0) {
      await this.channelRepository.delete({ id: roomId });
      this.channelMap.delete(Number(roomId));
    }
    await this.updateChannelMap();
  }

  async updateChannel(roomId: number, updateData: UpdateChannelDto) {
    const updateChannel = await this.channelRepository.findOne(roomId);
    console.log(updateChannel);
    for (const key in updateData) {
      updateChannel[key] = updateData[key];
    }
    await this.channelRepository.save(updateChannel);

    //update map
    await this.updateChannelMap();
  }

  async getChannelMember(roomId: number) {
    const member = await this.channelMemberRepository.find({
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
    const obj = member.map(({ userID, ...keepAttrs }) => keepAttrs);

    console.log(`get ChannelMember obj : `, obj);
    const result = [];
    obj.map((item) => {
      result.push({
        id: item['user'].id,
        avatar: item['user'].avatar,
        status: item['user'].status,
        nickname: item['user'].nickname,
      });
    });
    return result;
  }
}

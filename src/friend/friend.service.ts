import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BlockService } from 'src/block/block.service';
import { Block } from 'src/block/entity/block.entity';
import { CommunityGateway } from 'src/community/community.gateway';
import { StatusService } from 'src/community/status.service';
import { Friend } from 'src/friend/entity/friend.entity';
import { NotificationType } from 'src/notification/entity/notification.entity';
import { NotificationService } from 'src/notification/notification.service';
import { UserService } from 'src/user/user.service';
import { Repository } from 'typeorm';
import { RequestFriendResult } from './data/request-friend.result';
import { FriendRelationshipDto } from './dto/friend-relationship.dto';
import { FriendException } from './friend.exception';

@Injectable()
export class FriendService {
  constructor(
    @InjectRepository(Friend)
    private friendRepository: Repository<Friend>,
    @InjectRepository(Block)
    private blockRepository: Repository<Block>,
    @Inject(forwardRef(() => BlockService))
    private blockService: BlockService,
    @Inject(forwardRef(() => NotificationService))
    private notificationService: NotificationService,
    private userService: UserService,
    @Inject(forwardRef(() => CommunityGateway))
    private communityGateway: CommunityGateway,
    @Inject(forwardRef(() => StatusService))
    private statusService: StatusService,
  ) {}

  async deleteFriend(dto: FriendRelationshipDto) {
    await this.friendRepository.delete(dto);
    await this.friendRepository.delete({
      userId: dto.otherId,
      otherId: dto.userId,
    });
  }

  async setFriend(dto: FriendRelationshipDto) {
    if (dto.otherId == dto.userId) throw new BadRequestException();
    try {
      await this.friendRepository.insert(this.friendRepository.create(dto));
      await this.friendRepository.insert(
        this.friendRepository.create({
          userId: dto.otherId,
          otherId: dto.userId,
        }),
      );
      this.communityGateway.addFriendUser(dto.userId, dto.otherId);
      this.communityGateway.addFriendUser(dto.otherId, dto.userId);
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
  }

  async getFriendList(userId: number) {
    const blockList = this.blockRepository
      .createQueryBuilder('block')
      .select('block.otherId')
      .where('block.userId = :userId', { userId: userId });

    const friendList = await this.friendRepository
      .createQueryBuilder('friend')
      .where('friend.userId = :userId', { userId: userId })
      .andWhere(`friend.otherId NOT IN (${blockList.getSql()})`)
      .leftJoinAndSelect('friend.other', 'other')
      .orderBy('other.nickname', 'ASC')
      .getMany();
    return friendList.map((friend) => {
      return {
        status: this.statusService.getUserStatusById(friend.otherId),
        ...friend.other,
      };
    });
  }

  async getFriendById(dto: FriendRelationshipDto) {
    const result = await this.friendRepository.findOne({
      relations: ['other'],
      where: { userId: dto.userId, otherId: dto.otherId },
    });
    if (!result) throw new NotFoundException();
    return {
      status: this.statusService.getUserStatusById(result.otherId),
      ...result.other,
    };
  }

  throwRequestFriendError(result: RequestFriendResult) {
    throw new FriendException(result);
  }

  async requestFriend(dto: FriendRelationshipDto) {
    if (dto.otherId == dto.userId)
      return this.throwRequestFriendError(RequestFriendResult.Myself);
    try {
      const friend = await this.getFriendById(dto);
      if (friend)
        return this.throwRequestFriendError(RequestFriendResult.Already);
    } catch (error) {
      if (error instanceof FriendException) throw error;
    }
    try {
      await this.userService.getUserById(dto.otherId);
    } catch (error) {
      return this.throwRequestFriendError(RequestFriendResult.NotFoundUser);
    }
    try {
      const block = await this.blockService.getBlockById(dto);
      if (block) return this.throwRequestFriendError(RequestFriendResult.Block);
    } catch (error) {
      if (error instanceof FriendException) throw error;
    }
    try {
      const result = await this.notificationService.setNotification(
        dto.userId,
        {
          receiverId: dto.otherId,
          targetId: dto.otherId,
          type: NotificationType.FRIEND,
        },
      );
      if (!result)
        return this.throwRequestFriendError(RequestFriendResult.InProgress);
    } catch (error) {
      throw error;
    }
  }
}

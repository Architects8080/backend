import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CommunityGateway } from 'src/community/community.gateway';
import { FriendService } from 'src/friend/friend.service';
import { Repository } from 'typeorm';
import { BlockRelationshipDto } from './dto/block-relationship.dto';
import { Block } from './entity/block.entity';

@Injectable()
export class BlockService {
  constructor(
    @InjectRepository(Block)
    private blockRepository: Repository<Block>,
    @Inject(forwardRef(() => CommunityGateway))
    private communityGateway: CommunityGateway,
    @Inject(forwardRef(() => FriendService))
    private friendService: FriendService,
  ) {}

  async deleteBlock(dto: BlockRelationshipDto) {
    await this.blockRepository.delete(dto);
    try {
      const friend = await this.friendService.getFriendById(dto);
      if (friend) this.communityGateway.addFriendUser(dto.userId, dto.otherId);
    } catch (error) {}
  }

  async setBlock(dto: BlockRelationshipDto) {
    if (dto.otherId == dto.userId) throw new BadRequestException();
    try {
      await this.blockRepository.insert(this.blockRepository.create(dto));
      await this.communityGateway.removeFriendUser(dto.userId, dto.otherId);
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

  async getBlockList(userId: number) {
    return await this.blockRepository.find({
      relations: ['other'],
      select: ['other'],
      where: { userId: userId },
    });
  }
  async getBlockById(dto: BlockRelationshipDto) {
    const result = await this.blockRepository.findOne({
      relations: ['other'],
      where: { userId: dto.userId, otherId: dto.otherId },
    });
    if (!result) throw new NotFoundException();
    return result;
  }
}

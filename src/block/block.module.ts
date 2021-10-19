import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommunityModule } from 'src/community/community.module';
import { FriendModule } from 'src/friend/friend.module';
import { BlockController } from './block.controller';
import { BlockService } from './block.service';
import { Block } from './entity/block.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Block]),
    forwardRef(() => CommunityModule),
    forwardRef(() => FriendModule),
  ],
  controllers: [BlockController],
  providers: [BlockService],
  exports: [BlockService],
})
export class BlockModule {}

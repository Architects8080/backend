import {
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { BlockService } from './block.service';
import { Block } from './entity/block.entity';

@UseGuards(JwtAuthGuard)
@Controller('block')
export class BlockController {
  constructor(private blockService: BlockService) {}

  @Get()
  getBlockList(@Req() req) {
    return this.blockService.getBlockList(req.user.id);
  }

  @Post(':blockId')
  setBlock(@Req() req, @Param('blockId', ParseIntPipe) blockId: number) {
    return this.blockService.setBlock({
      userId: req.user.id,
      otherId: blockId,
    });
  }

  @Delete(':blockId')
  deleteBlock(@Req() req, @Param('blockId', ParseIntPipe) blockId: number) {
    return this.blockService.deleteBlock({
      userId: req.user.id,
      otherId: blockId,
    });
  }

  @Get(':blockId')
  async getFriendByID(
    @Req() req,
    @Param('blockId', ParseIntPipe) blockId: number,
  ) {
    const response: Block = await this.blockService.getBlockById({
      userId: req.user.id,
      otherId: blockId,
    });
    if (response) return response.other;
    throw new NotFoundException();
  }
}

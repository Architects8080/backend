import { HttpException, HttpStatus } from '@nestjs/common';
import { RequestFriendResult } from './data/request-friend.result';

export class FriendException extends HttpException {
  constructor(result: RequestFriendResult) {
    super(result, HttpStatus.BAD_REQUEST);
  }
}

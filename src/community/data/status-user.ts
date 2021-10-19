import { User } from 'src/user/entity/user.entity';
import { UserStatus } from './user-status';

export class StatusUser extends User {
  status: UserStatus;
}

export const mergeUserAndStatus = (user: User, status: UserStatus) => {
  const result: StatusUser = user as StatusUser;
  result.status = status;
  return result;
};

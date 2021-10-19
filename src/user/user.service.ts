import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entity/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async createUser(user: User) {
    let newUser: User = this.userRepository.create(user);

    try {
      return await this.userRepository.insert(newUser);
    } catch (error) {
      throw new BadRequestException();
    }
  }

  async getUsers() {
    return await this.userRepository.find();
  }

  async getUserById(id: number) {
    const user = await this.userRepository.findOne({ where: { id: id } });
    if (!user) throw new NotFoundException();
    return user;
  }

  async getUserByNickname(nickname: string) {
    const user = await this.userRepository.findOne({
      where: { nickname: nickname },
    });
    if (!user) throw new NotFoundException();
    return user;
  }

  async deleteUserById(id: number) {
    await this.userRepository.delete({ id: id });
  }

  async updateAvatar(user: User, file: Express.Multer.File) {
    await this.userRepository.update(user.id, { avatar: file.filename });
  }

  async updateUser(user: User) {
    await this.userRepository.update(user.id, user);
  }
}

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { PrismaClient } from '@prisma/client';
import { LoginUserDto, RegisterUserDto } from './dtos';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from 'src/interfaces/jwt-payload.interface';
import { envs } from 'src/config';

@Injectable()
export class AuthService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly jwtService: JwtService) {
    super();
  }

  onModuleInit() {
    this.$connect();
    this.logger.log('MONGODB CONNECTED');
  }

  async registerUser({ name, email, password }: RegisterUserDto) {
    try {
      const user = await this.user.findFirst({
        where: { email },
      });

      if (user) {
        throw new RpcException({
          status: 400,
          message: `User with email ${email} already exist`,
        });
      }

      const { password: __, ...newUser } = await this.user.create({
        data: {
          name,
          email,
          password: bcrypt.hashSync(password, 10),
        },
      });

      return {
        newUser,
        token: this.signJwt(user),
      };
    } catch (error) {
      throw new RpcException({
        status: 400,
        message: error.message,
      });
    }
  }

  async loginUser({ email, password }: LoginUserDto) {
    try {
      const user = await this.user.findFirst({
        where: { email },
      });

      if (!user) {
        throw new RpcException({
          status: 400,
          message: `User with email ${email} doesn't exist`,
        });
      }

      const passwordIsCorrect = bcrypt.compareSync(password, user.password);

      if (!passwordIsCorrect) {
        throw new RpcException({
          status: 400,
          message: `Password incorrect`,
        });
      }

      return {
        user,
        token: this.signJwt(user),
      };
    } catch (error) {
      throw new RpcException({
        status: 400,
        message: error.message,
      });
    }
  }

  async verifyToken(token: string) {
    try {
      const { sub, iat, exp, ...user } = this.jwtService.verify(token, {
        secret: envs.jwtSecret,
      });

      return {
        user,
        token: this.signJwt(user),
      };
    } catch (error) {
      throw new RpcException({
        status: 401,
        message: 'Invalid token',
      });
    }
  }

  signJwt(payload: JwtPayload) {
    return this.jwtService.sign(payload);
  }
}

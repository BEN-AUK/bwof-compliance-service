import { Inject, Injectable, Scope, UnauthorizedException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import type { Request } from 'express';
import type { RequestUser } from '../guards';

@Injectable({ scope: Scope.REQUEST })
export class AuthContext {
  constructor(@Inject(REQUEST) private readonly request: Request) {}

  getUser(): RequestUser {
    if (!this.request.user) {
      throw new UnauthorizedException('auth.user_not_available');
    }

    return this.request.user;
  }

  getProfileId(): string {
    return this.getUser().id;
  }

  getAccessToken(): string {
    if (!this.request.accessToken) {
      throw new UnauthorizedException('auth.access_token_not_available');
    }

    return this.request.accessToken;
  }
}

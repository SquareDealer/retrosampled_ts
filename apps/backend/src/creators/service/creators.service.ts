import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class CreatorsService {
  private supabaseForUser(jwt: string) {
    return createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${jwt}`,
          },
        },
      },
    );
  }

  async becomeCreator(userJwt: string) {
    if (!userJwt) {
      throw new UnauthorizedException();
    }

    const supabase = this.supabaseForUser(userJwt);

    const { data, error } = await supabase.rpc('become_creator');

    if (error) {
      if (error.message?.includes('profile_incomplete')) {
        throw new BadRequestException('Заполни профиль полностью');
      }
      if (error.message?.includes('profile_not_found')) {
        throw new BadRequestException('Сначала создай профиль');
      }
      throw new BadRequestException(error.message);
    }

    return data;
  }
}

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Profile } from "../models/Profile";
import { supabase } from "src/supabase/supabase-client";
import { UpdateProfileDto } from "../dto/update-profile.dto";
import { ProfileResponseDto } from "../dto/profile-response.dto";

@Injectable()
export class ProfileService {

    private mapToResponse(profile: Profile): ProfileResponseDto {
        return {
            userId: profile.user_id,
            username: profile.username ?? null,
            avatarUrl: profile.avatar_url ?? null,
            bio: profile.bio ?? null,
            links: profile.links ?? {},
        };
    }

    // Получение профиля по user_id
    async getProfileById(userId: string): Promise<ProfileResponseDto> {
        const { data, error } = await supabase
            .from('profile')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error || !data) {
            throw new NotFoundException('Profile not found');
        }

        return this.mapToResponse(data as Profile);
    }

    // Получение профиля по username
    async getProfileByUsername(username: string): Promise<ProfileResponseDto> {
        const { data, error } = await supabase
            .from('profile')
            .select('*')
            .eq('username', username)
            .single();
        if (error || !data) {
            throw new NotFoundException('Profile not found');
        }

        return this.mapToResponse(data as Profile);
    }

    // Обновление профиля пользователя
    async updateProfile(userId: string, dto: UpdateProfileDto): Promise<ProfileResponseDto> {

        if(dto.username) {
            const { data: existingUser } = await supabase
                .from('profile')
                .select('user_id')
                .eq('username', dto.username)
                .neq('user_id', userId)
                .single();

            if (existingUser) {
                throw new BadRequestException('Username already taken');
            }
        }

        const { data, error } = await supabase
            .from('profile')
            .update({
                ...dto,
                updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId)
            .select()
            .single();

        if (error || !data) {
            throw new BadRequestException(error?.message || 'Failed to update profile');
        }

        return this.mapToResponse(data as Profile);
    }
}


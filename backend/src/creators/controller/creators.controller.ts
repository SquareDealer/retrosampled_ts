import { Controller } from "@nestjs/common";
import { CreatorsService } from "../service/creators.service";
import { Post, Req, UseGuards } from "@nestjs/common";
import { SupabaseAuthGuard } from "src/auth/supabase-auth.guard";


@Controller('creators')
export class CreatorsController {

    constructor(private readonly creatorsService: CreatorsService) {}
    
    @Post('become')
    @UseGuards(SupabaseAuthGuard)
    become(@Req() req) {
        const token = req.token || req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            throw new Error('Token not found');
        }

        return this.creatorsService.becomeCreator(token);
    }
}
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';

export class EmailProfileDto {
  @IsEmail()
  email!: string;

  @IsUrl({ require_tld: false })
  url!: string;

  @IsOptional()
  @IsString()
  countryName?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  skillCount?: number;
}

import { IsArray, IsOptional, IsString, Length } from 'class-validator';

export class OpportunityPathwaysDto {
  @IsString()
  @Length(1, 200)
  occupationTitle!: string;

  @IsOptional()
  @IsString()
  iscoCode?: string;

  @IsString()
  @Length(2, 4)
  countryCode!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  matchedSkills?: string[];
}

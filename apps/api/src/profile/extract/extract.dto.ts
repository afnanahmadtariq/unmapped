import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class DemographicsDto {
  @IsOptional() @IsString() ageRange?: string;
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() workMode?: string;
}

class WorkEntryDto {
  @IsString() activity!: string;
  @IsInt() @Min(0) @Max(80) years!: number;
  @IsString() frequency!: string;
  @IsBoolean() paid!: boolean;
}

class ConstraintsDto {
  @IsOptional() @IsInt() @Min(0) maxTravelKm?: number;
  @IsOptional() @IsBoolean() needIncomeNow?: boolean;
  @IsOptional() @IsBoolean() canStudy?: boolean;
  @IsOptional() @IsBoolean() hasInternet?: boolean;
}

class ProfileContextDto {
  @IsOptional() @IsString() phoneAccess?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) selfLearning?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkEntryDto)
  workEntries?: WorkEntryDto[];

  @IsOptional() @IsArray() @IsString({ each: true }) tasks?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) tools?: string[];

  @IsOptional() @ValidateNested() @Type(() => ConstraintsDto)
  constraints?: ConstraintsDto;

  @IsOptional() @IsString() aspirations?: string;
}

export class ExtractInputDto {
  @IsString()
  @Length(2, 4)
  countryCode!: string;

  @IsString()
  educationLevel!: string;

  @IsArray()
  @IsString({ each: true })
  languages!: string[];

  @IsInt()
  @Min(0)
  @Max(80)
  yearsExperience!: number;

  @IsString()
  @Length(10, 4000)
  story!: string;

  @IsArray()
  @IsString({ each: true })
  declaredSkills!: string[];

  @IsOptional() @ValidateNested() @Type(() => DemographicsDto)
  demographics?: DemographicsDto;

  @IsOptional() @ValidateNested() @Type(() => ProfileContextDto)
  context?: ProfileContextDto;
}

export class ExtractInitialDto extends ExtractInputDto {}

export class ExtractFollowUpDto {
  @IsArray()
  history!: unknown[];

  @IsArray()
  lastAssistant!: unknown[];

  @IsObject()
  answers!: Record<string, string>;

  @ValidateNested()
  @Type(() => ExtractInputDto)
  baseInput!: ExtractInputDto;
}

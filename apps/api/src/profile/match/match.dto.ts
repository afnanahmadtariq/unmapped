import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class MatchOccupationsDto {
  @IsString()
  @Length(2, 4)
  countryCode!: string;

  /**
   * SkillsProfile object — passed through verbatim. We don't deep-validate
   * here because the profile is produced by the API itself in /profile/extract
   * and round-trips through the URL hash. Shape is enforced at the type level.
   */
  @IsObject()
  profile!: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  topN?: number;
}

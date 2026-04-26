import { IsString, Length } from 'class-validator';

export class FindJobsDto {
  @IsString()
  @Length(1, 200)
  title!: string;

  @IsString()
  @Length(2, 4)
  countryCode!: string;
}

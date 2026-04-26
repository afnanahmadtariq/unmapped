import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Country-level automation calibration: a global multiplier on Frey-Osborne
 * raw scores plus per-sector overrides. Captures the LMIC adjustment from
 * the original `lib/calibration.ts`.
 */
@Entity({ name: 'country_calibration' })
export class CountryCalibrationEntity {
  @PrimaryColumn({ type: 'varchar', length: 4 })
  countryCode!: string;

  @Column({ type: 'numeric', precision: 4, scale: 3 })
  globalMultiplier!: string;

  /** sectorId -> multiplier */
  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  sectorOverrides!: Record<string, number>;

  @Column({ type: 'text', nullable: true })
  rationale!: string | null;

  @Column({ type: 'varchar', length: 32, default: 'snapshot' })
  source!: string;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}

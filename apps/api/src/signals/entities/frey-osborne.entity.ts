import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Frey & Osborne (2013) automation probability per ISCO-08 occupation.
 * The country-specific calibration multiplier lives in `country_calibration`.
 */
@Entity({ name: 'frey_osborne_scores' })
export class FreyOsborneEntity {
  @PrimaryColumn({ type: 'varchar', length: 16 })
  iscoCode!: string;

  @Column({ type: 'numeric', precision: 4, scale: 3 })
  probability!: string;

  @Column({ type: 'varchar', length: 32, default: 'snapshot' })
  source!: string;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}

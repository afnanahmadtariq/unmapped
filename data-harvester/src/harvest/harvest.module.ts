import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { HarvestService } from './harvest.service';
import { IloIlostatHarvester } from './harvesters/ilo-ilostat.harvester';
import { WorldBankWdiHarvester } from './harvesters/wb-wdi.harvester';
import { WorldBankHciHarvester } from './harvesters/wb-hci.harvester';
import { IloIscoHarvester } from './harvesters/ilo-isco.harvester';
import { UnPopulationHarvester } from './harvesters/un-population.harvester';
import { WittgensteinHarvester } from './harvesters/wittgenstein.harvester';
import { UnescoUisHarvester } from './harvesters/unesco-uis.harvester';
import { FreyOsborneHarvester } from './harvesters/frey-osborne.harvester';
import { IloFowHarvester } from './harvesters/ilo-fow.harvester';
import { ItuDigitalHarvester } from './harvesters/itu-digital.harvester';
import { EscoHarvester } from './harvesters/esco.harvester';

const HARVESTERS = [
  IloIlostatHarvester,
  WorldBankWdiHarvester,
  WorldBankHciHarvester,
  IloIscoHarvester,
  UnPopulationHarvester,
  WittgensteinHarvester,
  UnescoUisHarvester,
  FreyOsborneHarvester,
  IloFowHarvester,
  ItuDigitalHarvester,
  EscoHarvester,
];

@Module({
  imports: [StorageModule],
  providers: [...HARVESTERS, HarvestService],
  exports: [HarvestService],
})
export class HarvestModule {}

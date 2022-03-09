import { create } from 'ipfs-http-client';
import type { OrbitDB as ODB } from 'orbit-db'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const OrbitDB = require('orbit-db')
import type DocumentStore from 'orbit-db-docstore';
import type {
    UtilityLookupItem,
    UtilityLookupItemInterface,
} from '../../utility-emissions-channel/chaincode/emissionscontract/typescript/src/lib/utilityLookupItem';
import type {
    UtilityEmissionsFactor,
    UtilityEmissionsFactorInterface,
} from '../../utility-emissions-channel/chaincode/emissionscontract/typescript/src/lib/utilityEmissionsFactor';
import type { CO2EmissionFactorInterface } from '../../utility-emissions-channel/chaincode/emissionscontract/typescript/src/lib/emissions-calc';
import {
    ErrInvalidFactorForActivity,
    ErrUnknownUOM,
} from '../../utility-emissions-channel/chaincode/emissionscontract/typescript/src/util/const';
import { ipfsClientUrl, orbitDbFullPath } from './config'

const DB_NAME = orbitDbFullPath;
const UTILITY_EMISSIONS_FACTOR_CLASS_IDENTIFER =
    'org.hyperledger.blockchain-carbon-accounting.utilityemissionsfactoritem';
const UTILITY_LOOKUP_ITEM_CLASS_IDENTIFIER =
    'org.hyperledger.blockchain-carbon-accounting.utilitylookuplist';
const UTILITY_EMISSIONS_FACTOR_TYPE = 'UTILITY_EMISSIONS_ELECTRICITY';

const UOM_FACTORS: { [key: string]: number } = {
    wh: 1.0,
    kwh: 1000.0,
    mwh: 1000000.0,
    gwh: 1000000000.0,
    twh: 1000000000000.0,
    kg: 1.0,
    t: 1000.0,
    ton: 1000.0,
    tons: 1000.0,
    tonnes: 1000,
    g: 0.001,
    kt: 1000000.0,
    mt: 1000000000.0,
    pg: 1000000000.0,
    gt: 1000000000000.0,
    'Room per night': 1,
    'passenger.km': 1,
    'tonne.km': 1,
};

const getYearFromDate = (date: string): number => {
    const time = new Date(date);
    if (!time.getFullYear()) {
        throw new Error(`${date} date format not supported`);
    }
    return time.getFullYear();
};

const getUomFactor = (uom: string): number => {
    const factor = UOM_FACTORS[uom.toLowerCase()];
    if (!factor) {
        throw new Error(`${ErrUnknownUOM} : ${uom} is not a valid uom`);
    }
    return factor;
};

export interface ActivityInterface {
    scope: string;
    level_1: string;
    level_2: string;
    level_3: string;
    activity_uom: string;
    activity: number;
    passengers?: number;
    tonnesShipped?: number;
}

export class OrbitDBService {
    private static _db: DocumentStore<UtilityLookupItemInterface | UtilityEmissionsFactorInterface>;

    public static init = async (): Promise<void> => {
        const ipfs = create({url:ipfsClientUrl});

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const orbitdb: ODB = await OrbitDB.createInstance(ipfs as any);
        const dbOptions = {
            // Give write access to the creator of the database
            accessController: {
                type: 'orbitdb',
                write: [orbitdb.id],
            },
            indexBy: 'uuid',
        };

        const db = await orbitdb.docstore(DB_NAME, dbOptions);

        await db.load();

        OrbitDBService._db = db as DocumentStore<
            UtilityLookupItemInterface | UtilityEmissionsFactorInterface
        >;
        console.log(`OrbitDB address: ${db.address.toString()}`);
    };

    public getUtilityLookupItem = (uuid: string): UtilityLookupItemInterface => {
        return OrbitDBService._db.get(uuid)[0];
    };

    public getAllUtilityLookupItems = (): UtilityLookupItemInterface[] => {
        return OrbitDBService._db.query(
            (doc: UtilityLookupItemInterface) => doc.class == UTILITY_LOOKUP_ITEM_CLASS_IDENTIFIER,
        ) as UtilityLookupItemInterface[];
    };

    public updateUtilityLookupItem = async (item: UtilityLookupItem): Promise<void> => {
        await OrbitDBService._db.put(item.item);
    };

    public getUtilityEmissionsFactor = (uuid: string): UtilityEmissionsFactorInterface => {
        return OrbitDBService._db.get(uuid)[0] as UtilityEmissionsFactorInterface;
    };

    public getAllFactors = (): UtilityEmissionsFactorInterface[] => {
        return OrbitDBService._db.get('') as UtilityEmissionsFactorInterface[];
    };

    public updateUtilityEmissionsFactor = async (factor: UtilityEmissionsFactor): Promise<void> => {
        await OrbitDBService._db.put(factor.factor);
    };

    public getUtilityEmissionsFactorsByDivision = (
        divisionID: string,
        divisionType: string,
        year?: number,
    ): UtilityEmissionsFactorInterface[] => {
        const maxYearLookup = 5; // if current year not found, try each preceding year up to this many times
        let retryCount = 0;
        let results: UtilityEmissionsFactorInterface[] = [];
        while (results.length === 0 && retryCount <= maxYearLookup) {
            if (year !== undefined) {
                results = OrbitDBService._db.query((doc: UtilityEmissionsFactorInterface) => {
                    const isEmissionsFactor =
                        doc.class === UTILITY_EMISSIONS_FACTOR_CLASS_IDENTIFER;
                    const isUtilityFactor = doc.type === UTILITY_EMISSIONS_FACTOR_TYPE;
                    const hasDivisionId = doc.division_id === divisionID;
                    const hasDivisionType = doc.division_type === divisionType;
                    const isOfQueriedYear = doc.year === (year + retryCount * -1).toString();
                    return (
                        isEmissionsFactor &&
                        isUtilityFactor &&
                        hasDivisionId &&
                        hasDivisionType &&
                        isOfQueriedYear
                    );
                }) as UtilityEmissionsFactorInterface[];
            } else {
                results = OrbitDBService._db.query((doc: UtilityEmissionsFactorInterface) => {
                    const isEmissionsFactor =
                        doc.class === UTILITY_EMISSIONS_FACTOR_CLASS_IDENTIFER;
                    const isUtilityFactor = doc.type === UTILITY_EMISSIONS_FACTOR_TYPE;
                    const hasDivisionId = doc.division_id === divisionID;
                    const hasDivisionType = doc.division_type === divisionType;
                    return isEmissionsFactor && isUtilityFactor && hasDivisionId && hasDivisionType;
                }) as UtilityEmissionsFactorInterface[];
            }
            retryCount++;
        }
        if (results.length === 0) {
            throw new Error('failed to get Utility Emissions Factors By division');
        }
        return results;
    };

    // used by recordEmissions
    public getEmissionsFactorByLookupItem = (
        lookup: UtilityLookupItemInterface,
        thruDate: string,
    ): UtilityEmissionsFactorInterface => {
        const hasStateData = lookup.state_province !== '';
        const isNercRegion = lookup.divisions?.division_type.toLowerCase() === 'nerc_region';
        const isNonUSCountry =
            lookup.divisions?.division_type.toLowerCase() === 'country' &&
            lookup.divisions?.division_id.toLowerCase() !== 'usa';
        let divisionID: string;
        let divisionType: string;
        let year: number;
        if (hasStateData) {
            divisionID = lookup.state_province;
            divisionType = 'STATE';
        } else if (isNercRegion) {
            divisionID = lookup.divisions?.division_id;
            divisionType = lookup.divisions?.division_type;
        } else if (isNonUSCountry) {
            divisionID = lookup.divisions?.division_id;
            divisionType = 'Country';
        } else {
            divisionID = 'USA';
            divisionType = 'Country';
        }

        try {
            year = getYearFromDate(thruDate);
        } catch (error) {
            console.error('could not fetch year');
            console.error(error);
        }

        console.log('fetching utilityFactors');
        const utilityFactors = this.getUtilityEmissionsFactorsByDivision(
            divisionID,
            divisionType,
            year,
        );

        if (utilityFactors.length === 0) {
            throw new Error('No utility emissions factor found for given query');
        }
        return utilityFactors[0];
    };

    public getEmissionsFactorByScope = (scope: string): UtilityEmissionsFactorInterface[] => {
        return OrbitDBService._db.query((doc: UtilityEmissionsFactorInterface) => {
            const isEmissionsFactor = doc.class === UTILITY_EMISSIONS_FACTOR_CLASS_IDENTIFER;
            const isOfQueriedScope = doc.scope?.toUpperCase() === scope.toUpperCase();
            return isEmissionsFactor && isOfQueriedScope;
        }) as UtilityEmissionsFactorInterface[];
    };

    public getEmissionsFactorByActivity = (
        activity: ActivityInterface,
    ): UtilityEmissionsFactorInterface[] => {
        return OrbitDBService._db.query((doc: UtilityEmissionsFactorInterface) => {
            const isEmissionsFactor = doc.class === UTILITY_EMISSIONS_FACTOR_CLASS_IDENTIFER;
            const isOfQueriedScope = doc.scope?.toUpperCase() === activity.scope.toUpperCase();
            const matchesLevel1 = doc.level_1 === activity.level_1.toUpperCase();
            const matchesLevel2 = doc.level_2 === activity.level_2.toUpperCase();
            const matchesLevel3 = doc.level_3 === activity.level_3.toUpperCase();
            const matchesActivityUOM =
                doc.activity_uom?.toUpperCase() === activity.activity_uom.toUpperCase();
            return (
                isEmissionsFactor &&
                isOfQueriedScope &&
                matchesLevel1 &&
                matchesLevel2 &&
                matchesLevel3 &&
                matchesActivityUOM
            );
        }) as UtilityEmissionsFactorInterface[];
    };

    public getCO2UtilityEmissionFactor = (
        factor: UtilityEmissionsFactorInterface,
        usage: number,
        usageUOM: string,
    ): CO2EmissionFactorInterface => {
        // initialize return variables
        let emissionsValue: number;
        let emissionsUOM: string;
        let renewableEnergyUseAmount: number;
        let nonrenewableEnergyUseAmount: number;

        // calculate emissions using percent_of_renewables if found
        if (factor.percent_of_renewables.length !== 0) {
            emissionsUOM = 'g';
            const co2EquivalentEmissionsUOM = factor.co2_equivalent_emissions_uom.split('/');
            if (co2EquivalentEmissionsUOM.length === 0) {
                console.error('co2_equivalent_emissions_uom not found in factor');
            }
            emissionsValue =
                (Number(factor.co2_equivalent_emissions) *
                    usage *
                    getUomFactor(co2EquivalentEmissionsUOM[0])) /
                getUomFactor(co2EquivalentEmissionsUOM[1]);
            const percentOfRenewables = Number(factor.percent_of_renewables) / 100;
            renewableEnergyUseAmount = usage * percentOfRenewables;
            nonrenewableEnergyUseAmount = usage * (1 - percentOfRenewables);
        } else {
            emissionsUOM = 'tons';

            const net_generation_uom = factor.net_generation_uom;
            const co2_equivalent_emissions_uom = factor.co2_equivalent_emissions_uom;

            const usageUOMConversion = getUomFactor(usageUOM) / getUomFactor(net_generation_uom);
            const emissionsUOMConversion =
                getUomFactor(co2_equivalent_emissions_uom) / getUomFactor(emissionsUOM);

            emissionsValue =
                (Number(factor.co2_equivalent_emissions) / Number(factor.net_generation)) *
                usage *
                usageUOMConversion *
                emissionsUOMConversion;

            const totalGeneration = Number(factor.non_renewables) + Number(factor.renewables);
            renewableEnergyUseAmount = usage * (Number(factor.renewables) / totalGeneration);
            nonrenewableEnergyUseAmount = usage * (Number(factor.non_renewables) / totalGeneration);
        }

        return {
            emission: {
                value: emissionsValue,
                uom: emissionsUOM,
            },
            division_type: factor.division_type,
            division_id: factor.division_id,
            renewable_energy_use_amount: renewableEnergyUseAmount,
            nonrenewable_energy_use_amount: nonrenewableEnergyUseAmount,
            year: Number(factor.year),
        };
    };

    public getCO2EmissionFactorByActivity = (
        factor: UtilityEmissionsFactorInterface,
        activity: ActivityInterface,
    ): CO2EmissionFactorInterface => {
        // initialize return variables
        let emissionsValue: number;
        const emissionsUOM = 'kg';

        const activityMatches =
            activity.scope?.toUpperCase() == factor.scope?.toUpperCase() &&
            activity.level_1 == factor.level_1 &&
            activity.level_2 == factor.level_2 &&
            activity.level_3 == factor.level_3 &&
            activity.activity_uom == factor.activity_uom;

        const isTonneKmUsed =
            factor.activity_uom == 'tonne.km' && activity.tonnesShipped !== undefined;
        const isPassengerKmUsed =
            factor.activity_uom == 'passenger.km' && activity.passengers !== undefined;

        // Check if activity matches the emissions factor
        if (activityMatches) {
            if (factor.activity_uom != 'tonne.km' && activity.activity_uom != 'passenger.km') {
                emissionsValue = activity.activity * parseFloat(factor.co2_equivalent_emissions);
            } else if (isTonneKmUsed) {
                emissionsValue =
                    activity.activity *
                    activity.tonnesShipped *
                    parseFloat(factor.co2_equivalent_emissions);
            } else if (isPassengerKmUsed) {
                emissionsValue =
                    activity.activity *
                    activity.passengers *
                    parseFloat(factor.co2_equivalent_emissions);
            } else {
                throw new Error(
                    `${ErrInvalidFactorForActivity} This emissions factor does not match the given activity`,
                );
            }
            return {
                emission: {
                    value: emissionsValue,
                    uom: emissionsUOM,
                },
                year: Number(factor.year),
            };
        } else {
            throw new Error(
                `${ErrInvalidFactorForActivity} This emissions factor does not match the given activity`,
            );
        }
    };
}

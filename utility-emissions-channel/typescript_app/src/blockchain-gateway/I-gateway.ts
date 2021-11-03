export interface IFabricTxCaller {
    // label for certificate stored in cert store
    userId: string;

    // require if server is using vault transit
    // key to signing ledger tx
    vaultToken?: string;
    // require if server is using web-socket
    // key session id its siganture to access ws-wallet signer
    webSocketKey?: IWebSocketKey;
}

export interface IWebSocketKey {
    sessionId: string;
    signature: string;
}

// ##############################################################
// gateway to utilityemissionchannel
// ##############################################################
export interface IUtilityemissionchannelGateway {
    recordEmissions(
        caller: IFabricTxCaller,
        input: IUtilityemissionchannelRecordEmissionsInput,
    ): Promise<IUtilityemissionchannelEmissionData>;
    getEmissionData(
        caller: IFabricTxCaller,
        uuid: string,
    ): Promise<IUtilityemissionchannelEmissionData>;

    getEmissionsRecords(
        caller: IFabricTxCaller,
        input: IUtilityemissionchannelGetEMissionsRecordsInput,
    ): Promise<IUtilityemissionchannelEmissionData[]>;

    getAllEmissionsDataByDateRange(
        caller: IFabricTxCaller,
        input: IUtilityemissionchannelGetAllEmissionsDataByDateRangeInput,
    ): Promise<IUtilityemissionchannelEmissionData[]>;
    updateEmissionsMintedToken(
        caller: IFabricTxCaller,
        input: IUtilityemissionchannelUpdateEmissionsMintedTokenInput,
    ): Promise<void>;
}

export interface IUtilityemissionchannelRecordEmissionsInput {
    utilityId: string;
    partyId: string;
    fromDate: string;
    thruDate: string;
    energyUseAmount: number;
    energyUseUom: string;
    url: string;
    md5: string;
}

export interface IUtilityemissionchannelEmissionData {
    uuid: string;
    utilityId: string;
    partyId: string;
    fromDate: string;
    thruDate: string;
    emissionsAmount: number;
    renewableEnergyUseAmount: number;
    nonrenewableEnergyUseAmount: number;
    energyUseUom: string;
    factorSource: string;
    url: string;
    md5: string;
    tokenId: string;
}

export interface IUtilityemissionchannelEmissionMetadata {
    org: string;
    type: string;
    partyId: string[];
    renewableEnergyUseAmount: number;
    nonrenewableEnergyUseAmount: number;
    utilityIds: string[];
    factorSources: string[];
    urls: string[];
    md5s: string[];
    fromDates: string[];
    thruDates: string[];
}

export interface IUtilityemissionchannelGetEMissionsRecordsInput {
    utilityId: string;
    partyId: string;
}

export interface IUtilityemissionchannelGetAllEmissionsDataByDateRangeInput {
    fromDate: string;
    thruDate: string;
}

export interface IUtilityemissionchannelUpdateEmissionsMintedTokenInput {
    tokenId: string;
    partyId: string;
    uuids: string[];
}
// ##############################################################
// gateway to datalock chaincode
// ##############################################################

export interface IDataLockGateway {
    getTxDetails(caller: IFabricTxCaller, txID: string): Promise<ITxDetails>;
    startTransitionProcess(caller: IFabricTxCaller, txID: string): Promise<ITxDetails>;
    endTransitionProcess(caller: IFabricTxCaller, txID: string): Promise<void>;
    stageUpdate(caller: IFabricTxCaller, input: ITxStageUpdateInput): Promise<ITxStageUpdateOutput>;
}

export interface ITxStageUpdateInput {
    tx_id: string;
    name: string;
    is_last?: boolean;
    data_locks?: { [key: string]: IDataChaincodeInput };
    data_free?: { [key: string]: IDataChaincodeInput };
    storage?: { [key: string]: string };
}

export interface ITxStageUpdateOutput {
    data_locks: { [key: string]: string };
    data_free: { [key: string]: string };
}

export interface IDataChaincodeInput {
    keys: string[];
    params: string[];
}
export interface ITxDetails {
    tx_id: string;
    state: TxState;
    current_stage: string;
    stage_data: { [key: string]: ITxStageData };
}

export interface ITxStageData {
    // key , value (base64) storage
    storage: { [key: string]: string };
    // chaincode => key value(base64)
    output: { [key: string]: { [key: string]: string } };
}

export enum TxState {
    FINISHED = 'FINISHED',
    PROCESSING = 'PROCESSING',
    NOT_PROCESSING = 'NOT-PROCESSING',
}

// ##############################################################
// gateway to fabric registry
// ##############################################################
export interface IFabricRegistryGateway {
    enroll(caller: IFabricTxCaller, secret: string): Promise<void>;
    register(caller: IFabricTxCaller, input: IFabricRegisterInput): Promise<IFabricRegisterOutput>;
}

export interface IFabricRegisterInput {
    enrollmentID: string;
    affiliation: string;
}

export interface IFabricRegisterOutput {
    enrollmentID: string;
    enrollmentSecret: string;
}

// ##############################################################
// gateway to ethereum net emissions token contract
// ##############################################################
export interface IEthNetEmissionsTokenGateway {
    issue(
        caller: IEthTxCaller,
        input: IEthNetEmissionsTokenIssueInput,
    ): Promise<IEthNetEmissionsTokenIssueOutput>;
}

export interface IEthTxCaller {
    address?: string;
    private?: string;

    // kv with vault
    keyName?: string;
}

export interface IEthNetEmissionsTokenIssueInput {
    addressToIssue: string;
    quantity: number;
    fromDate: number;
    thruDate: number;
    automaticRetireDate: number;
    metadata: string;
    manifest: string;
    description: string;
}

export interface IEthNetEmissionsTokenIssueOutput {
    tokenId: string;
    tokenTypeId: string;
    issuer: string;
    issuee: string;
    fromDate: string;
    thruDate: string;
    dateCreated: string;
    automaticRetireDate: string;
    metadata: string;
    manifest: string;
    description: string;
    availableBalance: string;
    retiredBalance: string;
}

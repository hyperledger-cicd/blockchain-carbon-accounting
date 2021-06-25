// ledger-config.ts : defines and read configuration for ledger integration
import {LogLevelDesc,Checks} from '@hyperledger/cactus-common'
import netEmissionTokenContractJSON from '../contracts/NetEmissionsTokenNetwork.json'
import {ConnectionProfile} from '@hyperledger/cactus-plugin-ledger-connector-fabric'
import {readFileSync} from 'fs'

export interface ILedgerIntegrationConfig{
    isDev?:boolean
    logLevel?:LogLevelDesc,
    keychainID?:string
    ethNode?:IEthNode
    netEmissionTokenContract?:INetEmissionTokenContractConfigs
    utilityEmissionsChaincode?:IFabricChaincodeConfig
}

interface IEthNode{
    url:string
    networkId:number
}

interface IEthContract{
    name:string
    address:string
    abi:Array<any>
}


interface INetEmissionTokenContractConfigs{
    contractInfo:IEthContract
    Keys:{
        public:string,
        private:string,
    }
}


interface IFabricOrgConfig{
    // path of connection profile
    ccpFile:string
    msp:string
    caName:string
}

interface IFabricChaincodeConfig{
    network:ConnectionProfile
    channelName:string
    chaincodeName:string
}

export function getLedgerConfigs():ILedgerIntegrationConfig{
    const config:ILedgerIntegrationConfig = {}
    const env = process.env.LEDGER_ENV || "prod"
    config.logLevel = "DEBUG"
    config.isDev = true
    if (env == "prod"){
        config.isDev = false
        config.logLevel = "INFO"
    }

    // 
    //================================================================
    // Ethereum network config read  ::::: start
    //
    const ethNodeURL = process.env.LEDGER_ETH_JSON_RPC_URL
    const ethNetwork = process.env.LEDGER_ETH_NETWORK
    Checks.nonBlankString(ethNodeURL,'LEDGER_ETH_JSON_RPC_URL')
    Checks.nonBlankString(ethNetwork,'LEDGER_ETH_NETWORK')
    let ethNetworkID:number
    if (ethNetwork == "xdai"){
        ethNetworkID = 1337
    }else if (ethNetwork == "goerli"){
        ethNetworkID = 5
    }else{
        throw new Error("LEDGER_ETH_NETWORK : xdai || goerli ethereum network are supported")
    }

    config.ethNode = {
        url: ethNodeURL,
        networkId: ethNetworkID,
    }

    config.keychainID = process.env.LEDGER_KEYCHAINID
    Checks.nonBlankString(config.keychainID,'LEDGER_KEYCHAINID')
    // net emission token contract details
    {
        const address = process.env.LEDGER_EMISSION_TOKEN_CONTRACT_ADDRESS
        Checks.nonBlankString(address,'LEDGER_EMISSION_TOKEN_CONTRACT_ADDRESS')
        const abi = netEmissionTokenContractJSON.abi
        const name = netEmissionTokenContractJSON.contractName

        const publicKey = process.env.LEDGER_EMISSION_TOKEN_PUBLIC_KEY
        const privateKey = process.env.LEDGER_EMISSION_TOKEN_PRIVATE_KEY

        Checks.nonBlankString(publicKey,'LEDGER_EMISSION_TOKEN_PUBLIC_KEY')
        Checks.nonBlankString(privateKey,'LEDGER_EMISSION_TOKEN_PRIVATE_KEY')

        config.netEmissionTokenContract = {
            Keys: {
                private: privateKey,
                public: publicKey,
            },
            contractInfo: {
                abi: abi,
                name: name,
                address: address
            }
        }
    }
    // 
    //================================================================
    // fabric network config read  ::::: start
    //
    const utilityEmissionsChaincodeCfg = process.env.LEDGER_EMISSION_NETWORK_CFG
    Checks.nonBlankString(utilityEmissionsChaincodeCfg,'LEDGER_EMISSION_NETWORK_CFG')
    const utilityEmissionsChaincode = readUtilityEmissionChaincodeCfg(utilityEmissionsChaincodeCfg)
    config.utilityEmissionsChaincode = utilityEmissionsChaincode
    return config
}

// function readtUtilityEmissionChaincodeCfg(cfgPath:string):/*IFabricChaincodeConfig*/{
export function readUtilityEmissionChaincodeCfg(cfgPath:string):IFabricChaincodeConfig{
    // containing :
    // channelName : 
    // chaincodeName :
    // orgCfgs : Map(orgName => IFabricOrgConfig)
    const configJSON = JSON.parse(readFileSync(cfgPath).toString()) as {
        channelName:string,
        chaincodeName:string,
        orgCfgs:{[key:string]:IFabricOrgConfig}
    }
    const certificateAuthorities:{[key:string]:object} = {}
    const peers:{[key:string]:object} = {}
    const orderers:{[key:string]:object} = {}
    const organizations:{[key:string]:object} = {}

    for(const key of Object.keys(configJSON.orgCfgs)){
        const orgCfg = configJSON.orgCfgs[key]
        const orgMSP = orgCfg.msp
        const ccp = JSON.parse(readFileSync(orgCfg.ccpFile).toString())
        const orgPeers = ccp["peers"]
        const orgOrderers = ccp["orderers"]
        const org:{mspid:string,peers:string[],certificateAuthorities:string[]} = {
            mspid:orgMSP,
            peers: [],
            certificateAuthorities: []
        }

        for (const key of Object.keys(orgPeers)){
            peers[`${orgMSP}_${key}`] = orgPeers[key]
            org.peers.push(`${orgMSP}_${key}`)
        }

        for (const key of Object.keys(orgOrderers)){
            orderers[`${orgMSP}_${key}`] = orgOrderers[key]
        }

        const ca = ccp["certificateAuthorities"]
        certificateAuthorities[`${orgMSP}_${orgCfg.caName}`] = ca[orgCfg.caName]
        org.certificateAuthorities.push(`${orgMSP}_${orgCfg.caName}`)

        organizations[key] = org
    }
    const ccp:ConnectionProfile = {
        name: "carbonAccounting_fabric_network",
        version: "1.0.0",
        description: "fabric network configuration for carbon accounting application",
        organizations: organizations,
        orderers: orderers,
        peers: peers,
        certificateAuthorities: certificateAuthorities
    }
    return {
        chaincodeName: configJSON.chaincodeName,
        channelName: configJSON.channelName,
        network: ccp
    }
}
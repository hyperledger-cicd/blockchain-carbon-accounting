#!/bin/bash

# Scipt generates crypto-material for one organization with 1 fabric-ca, 1 fabric peer, and fabric orderer


## Input variables
#### You need to set the following variables according to your organizations settings.

#### general
ORG=sampleOrg
ORG_DOMAIN=emissionsaccounting.sampleOrg.de
#### fabric-ca variables
CA_DOMAIN="fabric-ca.${ORG_DOMAIN}"
CA_ADMIN_USERNAME=sampleOrgAdmin
CA_ADMIN_PASSWORD=testPasswordCaAdmin
#### fabric peer
PEER_DOMAIN="fabric-peer4.${ORG_DOMAIN}"
PEER_SECRET=testPasswordPeer
#### fabric orderer
ORDERER_DOMAIN="fabric-orderer4.${ORG_DOMAIN}"
ORDERER_SECRET=testPasswordOrderer

export FABRIC_CA_CLIENT_TLS_CERTFILES=${PWD}/crypto-material/${ORG_DOMAIN}/fabric-ca/tls-cert.pem

## Copy fabric-ca tls cert to tls-cert.pem

function createCryptoMaterial() {

  echo
  echo "Enroll the CA admin"
  echo
  mkdir -p crypto-material/${ORG_DOMAIN}/

  export FABRIC_CA_CLIENT_HOME=${PWD}/crypto-material/${ORG_DOMAIN}/
  #  rm -rf $FABRIC_CA_CLIENT_HOME/fabric-ca-client-config.yaml
  #  rm -rf $FABRIC_CA_CLIENT_HOME/msp

  set -x
  fabric-ca-client enroll -u https://${CA_ADMIN_USERNAME}:${CA_ADMIN_PASSWORD}@${CA_DOMAIN}:443 --caname ${CA_DOMAIN}
  set +x

  CA_PEM="${CA_DOMAIN//./-}-443-${CA_DOMAIN//./-}.pem"
  echo "NodeOUs:
  Enable: true
  ClientOUIdentifier:
    Certificate: cacerts/${CA_PEM}
    OrganizationalUnitIdentifier: client
  PeerOUIdentifier:
    Certificate: cacerts/${CA_PEM}
    OrganizationalUnitIdentifier: peer
  AdminOUIdentifier:
    Certificate: cacerts/${CA_PEM}
    OrganizationalUnitIdentifier: admin
  OrdererOUIdentifier:
    Certificate: cacerts/${CA_PEM}
    OrganizationalUnitIdentifier: orderer" >"${FABRIC_CA_CLIENT_HOME}"/msp/config.yaml

  echo
  echo "Register peer1"
  echo
  set -x
  fabric-ca-client register --caname ${CA_DOMAIN} --id.name ${PEER_DOMAIN} --id.secret ${PEER_SECRET} --id.type peer --id.attrs "hf.Registrar.Roles=peer" 
  set +x

  echo
  echo "## Generate the peer1 msp"
  echo
  set -x
  fabric-ca-client enroll -u https://${PEER_DOMAIN}:${PEER_SECRET}@${CA_DOMAIN}:443 --caname ${CA_DOMAIN} -M ${PWD}/crypto-material/${ORG_DOMAIN}/peers/${PEER_DOMAIN}/msp --csr.hosts ${PEER_DOMAIN}
  set +x

  cp ${FABRIC_CA_CLIENT_HOME}/msp/config.yaml ${PWD}/crypto-material/${ORG_DOMAIN}/peers/${PEER_DOMAIN}/msp/config.yaml

  echo
  echo "## Generate the peer1-tls certificates"
  echo
  set -x
  fabric-ca-client enroll -u https://${PEER_DOMAIN}:${PEER_SECRET}@${CA_DOMAIN}:443  --caname ${CA_DOMAIN} -M ${PWD}/crypto-material/${ORG_DOMAIN}/peers/${PEER_DOMAIN}/tls --enrollment.profile tls --csr.hosts ${PEER_DOMAIN} 
  set +x

  cp ${PWD}/crypto-material/${ORG_DOMAIN}/peers/${PEER_DOMAIN}/tls/tlscacerts/* ${PWD}/crypto-material/${ORG_DOMAIN}/peers/${PEER_DOMAIN}/tls/ca.crt
  cp ${PWD}/crypto-material/${ORG_DOMAIN}/peers/${PEER_DOMAIN}/tls/signcerts/* ${PWD}/crypto-material/${ORG_DOMAIN}/peers/${PEER_DOMAIN}/tls/server.crt
  cp ${PWD}/crypto-material/${ORG_DOMAIN}/peers/${PEER_DOMAIN}/tls/keystore/* ${PWD}/crypto-material/${ORG_DOMAIN}/peers/${PEER_DOMAIN}/tls/server.key

  mkdir -p ${FABRIC_CA_CLIENT_HOME}/msp/tlscacerts
  cp ${PWD}/crypto-material/${ORG_DOMAIN}/peers/${PEER_DOMAIN}/tls/tlscacerts/* ${FABRIC_CA_CLIENT_HOME}/msp/tlscacerts/ca.crt

  mkdir -p ${FABRIC_CA_CLIENT_HOME}/tlsca
  cp ${PWD}/crypto-material/${ORG_DOMAIN}/peers/${PEER_DOMAIN}/tls/tlscacerts/* ${FABRIC_CA_CLIENT_HOME}/tlsca/tlsca.${ORG_DOMAIN}-cert.pem

  mkdir -p ${FABRIC_CA_CLIENT_HOME}/ca
  cp ${PWD}/crypto-material/${ORG_DOMAIN}/peers/${PEER_DOMAIN}/msp/cacerts/* ${FABRIC_CA_CLIENT_HOME}/ca/ca.${ORG_DOMAIN}-cert.pem

  echo
  echo "Register orderer"
  echo
  set -x
  fabric-ca-client register --caname ${CA_DOMAIN} --id.name ${ORDERER_DOMAIN} --id.secret ${ORDERER_SECRET} --id.type orderer --id.attrs "hf.Registrar.Roles=orderer"
  set +x
  set +x

  echo
  echo "## Generate the orderer msp"
  echo
  set -x
  fabric-ca-client enroll -u https://${ORDERER_DOMAIN}:${ORDERER_SECRET}@${CA_DOMAIN}:443 --caname ${CA_DOMAIN} -M ${PWD}/crypto-material/${ORG_DOMAIN}/orderers/${ORDERER_DOMAIN}/msp --csr.hosts ${ORDERER_DOMAIN}
  set +x

  cp ${FABRIC_CA_CLIENT_HOME}/msp/config.yaml ${PWD}/crypto-material/${ORG_DOMAIN}/orderers/${ORDERER_DOMAIN}/msp/config.yaml

  echo
  echo "## Generate the orderer-tls certificates"
  echo
  set -x
  fabric-ca-client enroll -u https://${ORDERER_DOMAIN}:${ORDERER_SECRET}@${CA_DOMAIN}:443 --caname ${CA_DOMAIN} -M ${PWD}/crypto-material/${ORG_DOMAIN}/orderers/${ORDERER_DOMAIN}/tls --enrollment.profile tls --csr.hosts ${ORDERER_DOMAIN}
  set +x

  cp ${PWD}/crypto-material/${ORG_DOMAIN}/orderers/${ORDERER_DOMAIN}/tls/tlscacerts/* ${PWD}/crypto-material/${ORG_DOMAIN}/orderers/${ORDERER_DOMAIN}/tls/ca.crt
  cp ${PWD}/crypto-material/${ORG_DOMAIN}/orderers/${ORDERER_DOMAIN}/tls/signcerts/* ${PWD}/crypto-material/${ORG_DOMAIN}/orderers/${ORDERER_DOMAIN}/tls/server.crt
  cp ${PWD}/crypto-material/${ORG_DOMAIN}/orderers/${ORDERER_DOMAIN}/tls/keystore/* ${PWD}/crypto-material/${ORG_DOMAIN}/orderers/${ORDERER_DOMAIN}/tls/server.key

  mkdir -p ${PWD}/crypto-material/${ORG_DOMAIN}/orderers/${ORDERER_DOMAIN}/msp/tlscacerts
  cp ${PWD}/crypto-material/${ORG_DOMAIN}/orderers/${ORDERER_DOMAIN}/tls/tlscacerts/* ${PWD}/crypto-material/${ORG_DOMAIN}/orderers/${ORDERER_DOMAIN}/msp/tlscacerts/tlsca.${ORG_DOMAIN}-cert.pem

  cp ${PWD}/crypto-material/${ORG_DOMAIN}/orderers/${ORDERER_DOMAIN}/tls/tlscacerts/* ${FABRIC_CA_CLIENT_HOME}/msp/tlscacerts/tlsca.${ORG_DOMAIN}-cert.pem

}


createCryptoMaterial
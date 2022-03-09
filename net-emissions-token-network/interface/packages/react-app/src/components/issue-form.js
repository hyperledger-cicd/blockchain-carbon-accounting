// SPDX-License-Identifier: Apache-2.0
import React, { useCallback, useEffect, useState } from "react";
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import { BsTrash, BsPlus } from 'react-icons/bs';
import Datetime from "react-datetime";
import "react-datetime/css/react-datetime.css";
import { encodeParameters, getAdmin, issue, TOKEN_TYPES } from "../services/contract-functions";
import CreateProposalModal from "./create-proposal-modal";
import SubmissionModal from "./submission-modal";

export default function IssueForm({ provider, roles, signedInAddress, limitedMode }) {

  const [submissionModalShow, setSubmissionModalShow] = useState(false);
  const [createModalShow, setCreateModalShow] = useState(false);

  // admin address (if contract is in limitedMode)
  const [adminAddress, setAdminAddress] = useState("");

  // Form inputs
  const [address, setAddress] = useState("");
  const [tokenTypeId, setTokenTypeId] = useState(1);
  const [quantity, setQuantity] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [thruDate, setThruDate] = useState("");
  const [automaticRetireDate, setAutomaticRetireDate] = useState("");
  const [manifest, setManifest] = useState("");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState("");
  const [metaJson, setMetaJson] = useState("");
  const [metadata, setMetadata] = useState([]);

  // Calldata
  const [calldata, setCalldata] = useState("");

  // After initial onFocus for required inputs, display red outline if invalid
  const [initializedAddressInput, setInitializedAddressInput] = useState(false);
  const [initializedQuantityInput, setInitializedQuantityInput] = useState(false);

  const onAddressChange = useCallback((event) => { setAddress(event.target.value); }, []);
  const onTokenTypeIdChange = useCallback((event) => { setTokenTypeId(event.target.value); }, []);
  const onQuantityChange = useCallback((event) => { setQuantity(event.target.value); }, []);
  const onFromDateChange = useCallback((event) => { setFromDate(event._d); }, []);
  const onThruDateChange = useCallback((event) => { setThruDate(event._d); }, []);
  const onAutomaticRetireDateChange = useCallback((event) => { setAutomaticRetireDate(event._d); }, []);
  // const onMetadataChange = useCallback((event) => { setMetadata(event.target.value); }, []);
  const onManifestChange = useCallback((event) => { setManifest(event.target.value); }, []);
  const onDescriptionChange = useCallback((event) => { setDescription(event.target.value); }, []);

  const castMetadata = (pairlist) => {
    // cast key/value into json object
    // let _metadata = {}
    // pairlist.map(pair => {
    //   _metadata[pair.key] = pair.value
    // });
    const _metadata = JSON.stringify(pairlist);
    return _metadata;
  }

  // handle metadata field list
  const removeField = (idx) => {
    let array = [...metadata];
    array.splice(idx, 1);
    setMetadata(array);
    setMetaJson(castMetadata(metadata));
  }

  const addField = () => {
    metadata.push({key: "", value: ""});
    setMetadata([...metadata]);
    setMetaJson(castMetadata(metadata));
  }

  function handleSubmit() {
    submit();
    setSubmissionModalShow(true);
  }

  function disableIssueButton(calldata, quantity, address) {
    let qty = Number(quantity);
    return (calldata.length === 0) || (qty === 0) || (String(address).length === 0)
  }

  // update calldata on input change
  useEffect(() => {
    if (signedInAddress) {
      let encodedCalldata;
      let qty = Number(quantity);
      qty = Math.round(quantity * 1000);

      try {
        encodedCalldata = encodeParameters(
          // types of params
          [
            'address',
            'address',
            'uint8',
            'uint256',
            'uint256',
            'uint256',
            'uint256',
            'string',
            'string',
            'string'
          ],
          // value of params
          [
            (limitedMode === true ? adminAddress : address),
            signedInAddress,
            tokenTypeId,
            qty,
            Number(fromDate)/1000,
            Number(thruDate)/1000,
            Number(automaticRetireDate)/1000,
            metaJson,
            manifest,
            ("Issued by DAO. " + description)
          ]
        );
      } catch (error) {
        encodedCalldata = "";
      }
      setCalldata(encodedCalldata);
    }
  }, [
    signedInAddress,
    limitedMode,
    adminAddress,
    address,
    tokenTypeId,
    quantity,
    fromDate,
    thruDate,
    automaticRetireDate,
    metaJson,
    manifest,
    description,
  ]);

  useEffect(() => {
    async function fetchAdmin() {
      setAdminAddress(await getAdmin(provider));
    }
    if (limitedMode === true) {
      fetchAdmin();
    }
  }, [limitedMode, provider]);

  useEffect(() => {
    if (roles[0] || roles[1]) {
      setTokenTypeId("1");
    } else if (roles[0] || roles[2]) {
      setTokenTypeId("2");
    } else if (roles[0] || roles[3]) {
      setTokenTypeId("3");
    }
  }, [roles]);

  async function submit() {
    // we consider quantity has 3 decimals, multiply by 1000 before passing to the contract
    let quantity_formatted;
    quantity_formatted = Math.round(quantity * 1000);
    console.log(tokenTypeId);

    const _metadata = castMetadata(metadata);
    console.log("metadata: ", _metadata);
    let result = await issue(provider, address, tokenTypeId, quantity_formatted, fromDate, thruDate, automaticRetireDate, _metadata, manifest, description);
    setResult(result.toString());
  }

  const inputError = {
    boxShadow: '0 0 0 0.2rem rgba(220,53,69,.5)',
    borderColor: '#dc3545'
  };

  return (roles[0] || roles[1] || roles[2] || roles[3] || roles[4]) ? (
    <>

      <CreateProposalModal
        show={createModalShow}
        title="Create a proposal"
        onHide={() => {
          setCreateModalShow(false);
        }}
        token={tokenTypeId}
        provider={provider}
        calldata={calldata}
        description={description}
      />

      <SubmissionModal
        show={submissionModalShow}
        title="Issue tokens"
        body={result}
        onHide={() => {setSubmissionModalShow(false); setResult("")} }
      />
      <h2>Issue tokens</h2>
      <p>Issue tokens (Renewable Energy Certificate, Carbon Emissions Offset, Audited Emissions, Carbon Tracker) to registered consumers.</p>

      { ((!limitedMode) || (tokenTypeId === "3"))
        ?
        <Form.Group>
          <Form.Label>Address</Form.Label>
          <Form.Control
            type="input"
            placeholder="0x000..."
            value={address}
            onChange={onAddressChange}
            onBlur={() => setInitializedAddressInput(true)}
            style={(address || !initializedAddressInput) ? {} : inputError}
          />
          <Form.Text className="text-muted">
            Must be a registered consumer or industry.
          </Form.Text>
        </Form.Group>
        :
        <Form.Group>
          <Form.Label>Address</Form.Label>
          <Form.Control
            type="input"
            value={adminAddress}
            disabled
            onBlur={() => setInitializedAddressInput(true)}
            style={(address || !initializedAddressInput) ? {} : inputError}
          />
          <Form.Text className="text-muted">
            Always set to admin address in limited mode.
          </Form.Text>
        </Form.Group>
      }


      <Form.Group>
        <Form.Label>Token Type</Form.Label>
        <Form.Control as="select" onChange={onTokenTypeIdChange}>
          <option value={0}>{}</option>
          {(roles[0] || roles[1]) ? <option value={1}>{TOKEN_TYPES[0]}</option> : null}
          {(roles[0] || roles[2]) ? <option value={2}>{TOKEN_TYPES[1]}</option> : null}
          {(roles[0] || roles[3]) ? <option value={3}>{TOKEN_TYPES[2]}</option> : null}
          {(roles[0] || roles[4]) ? <option value={4}>{TOKEN_TYPES[3]}</option> : null}
        </Form.Control>
      </Form.Group>
      <Form.Group>
        <Form.Label>Quantity</Form.Label>
        <Form.Control
          type="input"
          placeholder="0.000"
          value={quantity}
          onChange={onQuantityChange}
          onBlur={() => setInitializedQuantityInput(true)}
          style={(quantity || !initializedQuantityInput) ? {} : inputError}
        />
        {/* Display whether decimal is needed or not */}
        <Form.Text className="text-muted">
          Must not contain more than three decimal values.
        </Form.Text>
      </Form.Group>
      <Form.Row>
        <Form.Group as={Col}>
          <Form.Label>From date</Form.Label>
          <Datetime onChange={onFromDateChange}/>
        </Form.Group>
        <Form.Group as={Col}>
          <Form.Label>Through date</Form.Label>
          <Datetime onChange={onThruDateChange}/>
        </Form.Group>
        <Form.Group as={Col}>
          <Form.Label>Automatic retire date</Form.Label>
          <Datetime onChange={onAutomaticRetireDateChange}/>
        </Form.Group>
      </Form.Row>
      <Form.Group>
        <Form.Label>Description</Form.Label>
        <Form.Control as="textarea" placeholder="" value={description} onChange={onDescriptionChange} />
      </Form.Group>
      <Form.Group>
        <Form.Label>Metadata</Form.Label>
        <Form.Group>
          {metadata.map((field, key) => 
            <Row key={key} className="mt-2">
              <Col>
                <Form.Control 
                  type="input" 
                  value={field.key} 
                  onChange={e => { metadata[key].key = e.target.value; setMetadata([...metadata]); }}
                />
              </Col>
              <Col>
                <Form.Control 
                  type="input" 
                  value={field.value} 
                  onChange={e => { metadata[key].value = e.target.value; setMetadata([...metadata]); }}
                />
              </Col>
              <Col>
                <Button onClick={() => removeField(key)}><BsTrash /></Button>
              </Col>
            </Row>
          )}
          <br />
          <Row>
            <Col>
              <Button onClick={addField}><BsPlus /></Button>
            </Col>
          </Row>
        </Form.Group>
        {/* <Form.Control as="textarea" placeholder="E.g. Region and time of energy generated, type of project, location, etc." value={metadata} onChange={onMetadataChange} /> */}
      </Form.Group>
      <Form.Group>
        <Form.Label>Manifest</Form.Label>
        <Form.Control as="textarea" placeholder="E.g. URL linking to the registration for the REC, emissions offset purchased, etc." value={manifest} onChange={onManifestChange} />
      </Form.Group>

      <Row className="mt-4">
        <Col>

          {/* if in limited mode, require dealer role (except AE & CarbonTacker) to make a DAO proposal */}
          { (limitedMode && (!roles[0] && !roles[1] && !roles[2] && !roles[4]))
            ?
            <Button
              variant="success"
              size="lg"
              block
              disabled={true}
            >
              Must be a registered dealer
            </Button>
            :
            <Button
              variant="success"
              size="lg"
              block
              onClick={() => setCreateModalShow(true)}
              disabled={
                (calldata.length === 0) ||
                Number(quantity) === 0 ||
                tokenTypeId === "3"
              }
            >
              Create a DAO proposal token
            </Button>
          }

        </Col>

        { ( !limitedMode || tokenTypeId === "3" ) &&
          <Col>
            {/* Only enable issue if role is found */}
            { (roles[0] || roles[1] || roles[2] || roles[3] || roles[4])
              ?
                <Button
                  variant="primary"
                  size="lg"
                  block
                  onClick={handleSubmit}
                  disabled={disableIssueButton(calldata, quantity, address)}
                >
                  Issue
                </Button>
              :
                <Button variant="primary" size="lg" block disabled>Must be a registered dealer</Button>
            }
          </Col>
        }

      </Row>

    </>
  ) : (
    <p>You must be a registered dealer to issue tokens.</p>
  );
}

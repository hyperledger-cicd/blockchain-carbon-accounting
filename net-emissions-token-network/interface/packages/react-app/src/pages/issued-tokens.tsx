// SPDX-License-Identifier: Apache-2.0
import {
  forwardRef,
  ForwardRefRenderFunction,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
  MouseEvent,
  ChangeEvent
} from "react";
import Spinner from "react-bootstrap/Spinner";
import Button from 'react-bootstrap/Button';
import Table from "react-bootstrap/Table";
import { BsFunnel } from 'react-icons/bs';
import {
  getRoles,
  getTokenAmounts,
  getCarbonIntensity
} from "../services/contract-functions";
import TokenInfoModal from "../components/token-info-modal";
import { getBalances, getTokens, countAuditorEmissionsRequests } from '../services/api.service';
import Paginator from "../components/paginate";
import QueryBuilder from "../components/query-builder";
import { Balance, RolesInfo, Token, TOKEN_FIELDS, TOKEN_TYPES } from "../components/static-data";
import { Web3Provider, JsonRpcProvider } from "@ethersproject/providers";
import IssuedTypeSwitch from '../components/issue-type-switch';
import DisplayTokenAmount from "../components/display-token-amount";
import { Link } from "wouter";

type IssuedTokensProps = {
  provider?: Web3Provider | JsonRpcProvider, 
  signedInAddress: string, 
  displayAddress: string,
  roles: RolesInfo
}

type IssuedTokensHandle = {
  refresh: ()=>void
}

let issuedType = 'issuedBy';


const IssuedTokens: ForwardRefRenderFunction<IssuedTokensHandle, IssuedTokensProps> = ({ provider, signedInAddress, roles, displayAddress }, ref) => {
  // Modal display and token it is set to
  const [modalShow, setModalShow] = useState(false);
  const [selectedToken, setSelectedToken] = useState({});

  // Balances of my tokens and tokens I've issued
  const [myBalances, setMyBalances] = useState<any[]>([]);
  const [myIssuedTokens, setMyIssuedTokens] = useState<Token[]>([]);

  const [fetchingTokens, setFetchingTokens] = useState(false);

  const [ emissionsRequestsCount, setEmissionsRequestsCount ] = useState(0);

  const [error, setError] = useState("");

  const isDealer = roles.hasDealerRole;
  const isIndustry = roles.hasIndustryRole;
  const [displayAddressIsDealer, setDisplayAddressIsDealer] = useState(false);
  const [displayAddressIsIndustry, setDisplayAddressIsIndustry] = useState(false);

  // state vars for pagination
  const [ page, setPage ] = useState(1);
  const [ count, setCount ] = useState(0);
  const [ pageSize, setPageSize ] = useState(20);
  const [ query, setQuery ] = useState<string[]>([]);

  const [ balancePage, setBalancePage ] = useState(1);
  const [ balancePageSize, setBalancePageSize ] = useState(20);
  const [ balanceQuery, setBalanceQuery ] = useState<string[]>([]);

  const [showQueryBuilder, setShowQueryBuilder] = useState(false);

  // issue type : default issuedBy
  const onIssudTypeChanged = async (type: string) => {
    issuedType = type;
    await fetchTokens(page, pageSize, query);
  }

  async function handlePageChange(_: ChangeEvent<HTMLInputElement>, value: number) {
    await fetchTokens(value, pageSize, query);
  }

  async function handlePageSizeChange(event: ChangeEvent<HTMLInputElement>) {
    await fetchTokens(1, parseInt(event.target.value), query);
  }

  async function handleQueryChanged(_query: string[]) {
    await fetchTokens(page, pageSize,  _query);
  }

  function handleOpenTokenInfoModal(token: Token) {
    setSelectedToken(token);
    setModalShow(true);
  }

  // Allows the parent component to refresh balances on clicking the button in the navigation
  useImperativeHandle(ref, () => ({
    refresh() {
      handleRefresh();
    }
  }));

  function switchQueryBuilder() {
     setShowQueryBuilder(!showQueryBuilder);
  }

  async function handleRefresh() {
    // clear localStorage
    let localStorage = window.localStorage;
    localStorage.setItem('token_balances', '');

    setFetchingTokens(true);
    await fetchTokens(page, pageSize, query);
    await fetchBalances(balancePage, balancePageSize, balanceQuery);
  }

  async function fetchAddressRoles(provider: Web3Provider | JsonRpcProvider, address: string) {
    if (!address || !address.length) {
      setDisplayAddressIsDealer(false);
      setDisplayAddressIsIndustry(false);
    } else {
      const dRoles = await getRoles(provider, address);
      setDisplayAddressIsDealer(!!dRoles.hasDealerRole);
      setDisplayAddressIsIndustry(!!dRoles.hasIndustryRole);
    }
  }

  useEffect(() => {
    if(provider) fetchAddressRoles(provider, displayAddress);
  }, [provider, displayAddress])

  const fetchBalances = useCallback(async (_balancePage: number, _balancePageSize: number, _balanceQuery: string[]) => {

    try {
      // get total count of balance
      const query = `issuedTo,string,${signedInAddress},eq`;
      const offset = (_balancePage - 1) * _balancePageSize;

      // this count means total number of balances
      let {balances} = await getBalances(offset, _balancePageSize, [..._balanceQuery, query]);


      const newMyBalances = balances.map((balance) => {
        return {
          ...balance,
          tokenId: balance.token.tokenId,
          token: balance.token,
          tokenType: TOKEN_TYPES[balance.token.tokenTypeId - 1],
          issuedTo: balance.issuedTo,
          availableBalance: balance.available,
          retiredBalance: balance.retired,
        }
      });
      setMyBalances(newMyBalances);
    } catch (error) {
      console.error(error)
      setMyBalances([]);
    }

    setBalancePage(_balancePage);
    setBalancePageSize(_balancePageSize);
    setBalanceQuery(_balanceQuery);
    setFetchingTokens(false);
  }, [signedInAddress]);

  const fetchTokens = useCallback(async (_page: number, _pageSize: number, _query: string[]) => {

    let newMyIssuedTokens = [];
    let _issuedCount = 0;
    try {
      // First, fetch number of unique tokens
      const query = `${issuedType},string,${signedInAddress},eq`;
      const offset = (_page - 1) * _pageSize;

      // this count means total number of issued tokens
      let {tokens, count} = await getTokens(offset, _pageSize, [..._query, query]);
      // this count means total pages of issued tokens
      _issuedCount = count % _pageSize === 0 ? count / _pageSize : Math.floor(count / _pageSize) + 1;
      // fetch token from database
      // my tokens
      // Iterate over each tokenId and find balance of signed in address
      for (let i = 1; i <= _pageSize; i++) {
        let tokenDetails = tokens[i-1];
        if (!tokenDetails) continue;

        let token: Token = {
          tokenId: tokenDetails.tokenId,
          scope: tokenDetails.scope,
          type: tokenDetails.type,
          tokenTypeId: tokenDetails.tokenTypeId,
          tokenType: TOKEN_TYPES[tokenDetails.tokenTypeId - 1],
          issuedFrom: tokenDetails.issuedFrom,
          issuedBy: tokenDetails.issuedBy,
          issuedTo: tokenDetails.issuedTo,
          dateCreated: tokenDetails.dateCreated,
          fromDate: tokenDetails.fromDate,
          thruDate: tokenDetails.thruDate,
          metadata: tokenDetails.metadata,
          manifest: tokenDetails.manifest,
          description: tokenDetails.description,
          totalIssued: tokenDetails.totalIssued,
          totalRetired: tokenDetails.totalRetired,
        };

        newMyIssuedTokens.push(token);
        token.isMyIssuedToken = true;
      }

    } catch (error) {
      console.log(error);
      setError("Could not connect to contract on the selected network. Check your wallet provider settings.");
    }

    // setMyBalances(newMyBalances);
    setMyIssuedTokens(newMyIssuedTokens);    
    setFetchingTokens(false);
    setError("");
    setCount(_issuedCount);
    setPage(_page);
    setPageSize(_pageSize);
    setQuery(_query);
  }, [provider, signedInAddress]);

  // If address and provider detected then fetch balances
  useEffect(() => {
    const init = async () => {
      if (provider && signedInAddress) {
        if (myBalances !== [] && !fetchingTokens) {
          setFetchingTokens(true);
          await fetchTokens(page, pageSize, query);
          await fetchBalances(balancePage, balancePageSize, balanceQuery);
        }
        let _emissionsRequestsCount = await countAuditorEmissionsRequests(signedInAddress);
        setEmissionsRequestsCount(_emissionsRequestsCount);
    } }
    init();
  }, [provider, signedInAddress]);

  function pointerHover(e: MouseEvent<HTMLElement>) {
    e.currentTarget.style.cursor = "pointer";
  }

  return (
    <>
      <TokenInfoModal
        show={modalShow}
        token={selectedToken}
        onHide={() => {
          setModalShow(false);
          setSelectedToken({});
        }}
      />

      <p className="text-danger">{error}</p>

      <div className={fetchingTokens ? "dimmed" : ""}>

        {fetchingTokens && (
          <div className="text-center my-4">
            <Spinner animation="border" role="status">
              <span className="visually-hidden">Loading...</span>
            </Spinner>
          </div>
        )}


        {/* Only display issued tokens if owner or dealer */}
        {((!displayAddress && isDealer) || (displayAddress && displayAddressIsDealer)) &&
          <div className="mt-4">
            <h2 style={{display: 'inline'}}>
              Tokens&nbsp;
            </h2>
            <IssuedTypeSwitch
              changed={onIssudTypeChanged}
              h={(displayAddress? 'them' : 'you')}
            />
            &nbsp;
            <Button className="mb-3" onClick={switchQueryBuilder} variant={(showQueryBuilder) ? 'dark' : 'outline-dark'}><BsFunnel /></Button>
            <Link href="/issue">
              <Button
                className="float-end"
                variant="outline-dark"
              >
                Issue
              </Button>
            </Link>

            {(emissionsRequestsCount) ?
              <p className="mb-1">You have {emissionsRequestsCount} pending <Link href="/emissionsrequests">emissions audits</Link>.</p>
              : null
            }
            <div hidden={!showQueryBuilder}>
              <QueryBuilder
                fieldList={TOKEN_FIELDS}
                handleQueryChanged={handleQueryChanged}
              />
            </div>
            <Table hover size="sm">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Issued</th>
                  <th>Retired</th>
                </tr>
              </thead>
              <tbody>
                {(myIssuedTokens !== [] && !fetchingTokens) &&
                  myIssuedTokens.map((token) => (
                    <tr
                      key={token.tokenId}
                      onClick={() => handleOpenTokenInfoModal(token)}
                      onMouseOver={pointerHover}
                    >
                      <td>{token.tokenId}</td>
                      <td>{token.tokenType}</td>
                      <td>{token.description}</td>
                      <td><DisplayTokenAmount amount={token.totalIssued}/></td>
                      <td><DisplayTokenAmount amount={token.totalRetired}/></td>
                    </tr>
                  ))}
              </tbody>
            </Table>
            {myIssuedTokens.length !== 0 ? <Paginator 
              count={count}
              page={page}
              pageSize={pageSize}
              pageChangeHandler={handlePageChange}
              pageSizeHandler={handlePageSizeChange}
            /> : <></>}
          </div>
        }
      </div>
    </>
  );
}

export default forwardRef(IssuedTokens);

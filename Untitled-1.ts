export function tokenName(token: AccountId): ContractPromise { //token is the fungible token contract account for the token being asked balance for given account
    let args = new TokenNameArgs()
  
    let promise = ContractPromise.create(
      token, // contract account Id
      "getTokenName", // method
      args.encode(), // serialized contract method arguments as Uint8Array
      DEFAULT_GAS_VALUE, // gas attached to call
      u128.Zero) // attached deposit to be sent with call
  
    //setting up args for the callback
    let responseArgs = new OnGetTokenNameCalled()
    logging.log(responseArgs)
  
    logging.log(Context.contractName)
  
    let callbackPromise = promise.then(
      Context.contractName,
      "_tokenName",
      responseArgs.encode(),
      2
    )
    return callbackPromise
  }
  
  export function _thistokenName(): string {
  const name = ''
  let results = ContractPromise.getResults()
  
  assert(results.length > 0, "should be contract promise result")
  let data = results[0]
  
  //verifying the remote contract call succeeded
  if(data.status == 1) {
    //Decoding data from the bytes buffer into the local object
  logging.log('data buffer' + data.buffer.toString() + 'data status' + data.status.toString())
   let result = decode<OnGetTokenCalled>(data.buffer)
    logging.log(result)
    return result.tokenName.tokenName
  }
  return name
  }
  
  @nearBindgen
  class OnGetTokenCalled {
    constructor(public tokenName: OnGetTokenNameCalled){}
  }




  getATokenName(token: AccountId): void {
    
    logging.log("prepaid gas " + Context.prepaidGas.toString())
    let promise = ContractPromise.create(
      token, // contract account Id (vpc.vitalpointai.testnet)
      "getTokenName", // method
      new Uint8Array(0), // serialized contract method arguments as Uint8Array - method needs no args
      u64(300000000000000), // gas attached to call
      u128.Zero) // attached deposit to be sent with call
      
      //setting up args for the callback
    // let responseArgs: OnGetTokenNameCalled = {
    //   tokenName: ''
    // }
     let responseArgs = new OnGetTokenNameCalled()
    let callbackPromise = promise.then(
      Context.contractName,
      "_tokenName",
      responseArgs.encode(),
      2
    )
    callbackPromise.returnAsResult()
  }
  
  _tokenName(): string {
    let results = ContractPromise.getResults()
    assert(results.length > 0, "should be contract promise result")
    let data = results[0]
    
    //verifying the remote contract call succeeded
    if(data.status == 1) {
      //Decoding data from the bytes buffer into the local object
      let result = decode<OnGetTokenNameCalled>(data.buffer)
      logging.log(result)
      return result.tokenName
    }
    return ''
    }

    export class fungibleTokenApi {
        transferFrom(from: AccountId, to: AccountId, amount: Amount, tributeToken: AccountId): ContractPromise { //tributeToken is the fungible token contract account for the tributeToken
          let args: TransferFromArgs = { owner_id: from, new_owner_id: to, amount: amount }
          let promise = ContractPromise.create(tributeToken, "transfer_from", args.encode(), 100000000000000, u128.Zero)
        
          return promise
        }
      
        _transferFrom(): bool {
          let results = ContractPromise.getResults()
          assert(results.length > 0, "should be contract promise result")
          let result = results[0]
      
          //verifying remote contract call succeeded
          if(result.status == 1) {
            return true
          }
          return false
        }
      
        transfer(to: AccountId, amount: Amount, token: AccountId): ContractPromise { //token is the fungible token contract account for the token being transferred
          let args: TransferArgs = { to, amount }
          let promise = ContractPromise.create(token, "transfer", args.encode(), DEFAULT_GAS_VALUE, u128.Zero)
          
          return promise
        }
      
        _transfer(): bool {
          let results = ContractPromise.getResults()
          assert(results.length > 0, "should be contract promise result")
          let result = results[0]
      
          //verifying remote contract call succeeded
          if(result.status ==1) {
            return true
          }
          return false
        }
      
        balanceOf(token: AccountId, account: AccountId): ContractPromise { //token is the fungible token contract account for the token being asked balance for given account
          let args: BalanceArgs = {account}
      
          let promise = ContractPromise.create(
            token, // contract account Id
            "get_balance", // method
            args.encode(), // serialized contract method arguments as Uint8Array
            DEFAULT_GAS_VALUE, // gas attached to call
            u128.Zero) // attached deposit to be sent with call
      
          //setting up args for the callback
          let responseArgs = new OnBalanceCalledArgs()
       
      
          let callbackPromise = promise.then(
            Context.contractName,
            "_balanceOf",
            responseArgs.encode(),
            2
          )
          return callbackPromise
        }
      
      _balanceOf(account: AccountId): u128 {
        const amount = u128.Zero
        let results = ContractPromise.getResults()
        assert(results.length > 0, "should be contract promise result")
        let data = results[0]
      
        //verifying the remote contract call succeeded
        if(data.status == 1) {
          //Decoding data from the bytes buffer into the local object
          let balance = decode<OnBalanceCalledArgs>(data.buffer)
          logging.log(balance)
          return balance.amount
        }
        return amount
      }
      }

      export function submitMemberProposal(applicant: AccountId, shares: u128, tribute: u128, tributeType: string, proposalIdentifier: string): u64 {
        REENTRANTGUARD.nonReentrantOpen()
        assert(env.isValidAccountID(applicant), ERR_INVALID_ACCOUNT_ID)  
        assert(members.get(applicant)==null, ERR_ALREADY_MEMBER)
        assert(shares > u128.Zero, ERR_MUSTBE_GREATERTHAN_ZERO)
        assert(tribute > u128.Zero, ERR_MUSTBE_GREATERTHAN_ZERO)
      
        // collect tribute from proposer and store it in the Moloch until the proposal is processed
        let ftAPI = new tokenAPI()
        ftAPI.incAllowance(tribute, tributeType)
        ftAPI.transferFrom(Context.sender, MOLOCH_CONTRACT_ACCOUNT, tribute, tributeType)
        
       _unsafeAddToBalance(ESCROW, tributeType, tribute)
       logging.log('user member token balance '+ getUserTokenBalance(ESCROW, tributeType).toString())
      
        let flags = new Array<bool>(7) // [sponsored, processed, didPass, cancelled, whitelist, guildkick, member]
        flags[6] = true; // member Proposal
        
        _submitProposal(proposalIdentifier, applicant, shares, u128.Zero, tribute, tributeType, u128.Zero, '', flags)
        REENTRANTGUARD.nonReentrantClose()
        return proposalCount-1
      }
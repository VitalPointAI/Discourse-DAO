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


      export function isVotingPeriod(pI: i32): void {
        let proposal = proposals[pI]
        let current = getCurrentPeriod()
        logging.log('current ' + current.toString())
        logging.log('proposal SP ' + proposal.sP.toString())
        logging.log('context timestamp' + Context.blockTimestamp.toString())
        if(current >= proposal.sP && current <= (proposal.sP + storage.getSome<i32>('votingPeriodLength'))){
          logging.log('proposal VP before' + proposal.vP.toString())
          proposal.vP = true
          logging.log('proposal VP after' + proposal.vP.toString())
          proposal.gP = false
          proposals[pI] = proposal
      
          let index = getProposalEventsIndex(pI)
          logging.log(' index in vote ' + index.toString())
          let proposalEvent = submitProposalEvents[index]
          proposalEvent.vP = true
          proposalEvent.gP = false
          submitProposalEvents[index] = proposalEvent
        }
      }
      
      export function isGracePeriod(pI: i32): void {
        let proposal = proposals[pI]
        let current = getCurrentPeriod()
        let votingPeriod = proposal.sP + storage.getSome<i32>('votingPeriodLength')
        let endGP = votingPeriod + storage.getSome<i32>('gracePeriodLength')
        if(current >= votingPeriod && current <= endGP ){
          proposal.vP = false
          proposal.gP = true
          proposals[pI] = proposal
      
          let index = getProposalEventsIndex(pI)
          let proposalEvent = submitProposalEvents[index]
          proposalEvent.vP = false
          proposalEvent.gP = true
          submitProposalEvents[index] = proposalEvent
        }
      }



      // flags [sponsored, processed, didPass, cancelled, whitelist, guildkick, member]
  function handleProposalCountChange() {
    if(proposalList.length > 0){
      let i = 0
      let pCount = 0
      while (i < proposalList.length) {
        pCount += proposalList[i].filter((x) => !x.flags[0] && !x.flags[1] && !x.flags[3]).length
        i++
      }
      setProposalCount(pCount)
    }
  }

  function handleVotingCountChange() {
    if(proposalList.length > 0){
      let i = 0
      let vCount = 0
      while (i < proposalList.length) {
        vCount += proposalList[i].filter((x) => x.flags[0] && !x.flags[1] && !x.flags[3] && (x.votingPeriod || x.gracePeriod)).length
        i++
      }
      setVotingCount(vCount)
    }
  }

  function handleProcessCountChange() {
    if(proposalList.length > 0){
      let i = 0
      let prCount = 0
      while (i < proposalList.length) {
        prCount += proposalList[i].filter((x) => x.flags[0] && x.flags[1] && !x.flags[3]).length 
        i++
      }
      setProcessCount(prCount)
    }
  }

  function handleQueueCountChange() {
    if(proposalList.length > 0){
      let i = 0
      let qCount = 0
      while (i < proposalList.length) {
        qCount += proposalList[i].filter((x) => x.flags[0] && !x.flags && !x.votingPeriod && !x.gracePeriod).length
        i++
      }
      setQueueCount(qCount)
    }
  }



  //import {Libp2pCryptoIdentity} from '@textile/threads-core';
import { Client, ThreadID, PrivateKey, createUserAuth } from '@textile/hub';
import { encryptSecretBox, decryptSecretBox, parseEncryptionKeyNear } from './encryption'
import Big from 'big.js'

const appId = process.env.APP_ID;

let appDatabase;
let userDatabase;

const BOATLOAD_OF_GAS = Big(3).times(10 ** 14).toFixed()

export async function generateIdentity() {
    let identity
    try {
        let storedIdent = localStorage.getItem(appId + ":" + process.env.THREADDB_APPIDENTITY_STRING)
        if (storedIdent === null) {
            throw new Error('No Identity')
        }
        identity = PrivateKey.fromString(storedIdent)
        let loginCallback = appLoginWithChallenge(identity);
        console.log('login Callback ', loginCallback)
        return identity
    } catch (e) {
        try {
            identity = PrivateKey.fromRandom()
            const identityString = identity.toString()
            let loginCallback = appLoginWithChallenge(identity);
            console.log('login Callback ', loginCallback)
            localStorage.setItem(appId + ":" + process.env.THREADDB_APPIDENTITY_STRING, identityString)
        } catch (err) {
            return err.message
        }
    }
    return identity
}

export async function getAppIdentity(publicKey) {
      const type = 'org';
      /** Restore any cached app identity first */
   //   const cached = localStorage.getItem(appId + ":" + process.env.THREADDB_APPIDENTITY_STRING)
    
  //    if (cached !== null) {
   //   /**Convert the cached app identity string to a Libp2pCryptoIdentity and return */
   //   return PrivateKey.fromString(cached)
   //   }
  
      /** Try and retrieve app identity from contract if it exists */
  //    if (cached === null) {
              try {

                 /** No cached identity existed, so create a new one */
                 let identity = await PrivateKey.fromRandom()
                 console.log('identity ', identity)
                  
                 /** Add the string copy to the cache */
                 localStorage.setItem(appId + ":" + process.env.THREADDB_APPIDENTITY_STRING, identity.toString())

                 const challenge = Buffer.from(publicKey.toString())
                 console.log('challenge ', challenge)
                 const credentials = await identity.sign(challenge)

                 console.log('credentials ', credentials)

                let loginCallback = appLoginWithChallenge(identity);
                console.log('login Callback ', loginCallback)

                 const keyInfo = {
                     key: process.env.APP_KEY,
                     secret: process.env.APP_SECRET_KEY
                 }

                 const expiration = new Date(Date.now() + 60 * 1000)

                 const auth = await createUserAuth(keyInfo.key, keyInfo.secret ?? '', expiration)
                 console.log('userAuth ', auth)
                
                 const client = Client.withUserAuth(credentials)
                 console.log('client ', client)

                 const token = await client.getToken(identity)
                 return token

                //   let tempIdentity = await PrivateKey.fromRandom()
  
                //   let loginCallback = appLoginWithChallenge(tempIdentity);
                //   let db = Client.withUserAuth(loginCallback);
                //   let token = await db.getToken(tempIdentity)
  
                //   if(token) {
                //   /**Get encryption key*/
                //   let loginCallback = loginWithChallengeEK(tempIdentity);    
                //   let encKey = await Promise.resolve(loginCallback)
                //   let encryptionKey = encKey.enckey
                //   parseEncryptionKeyNear(appId, type, encryptionKey);
                //   let retrieveId = await window.contract.getAppIdentity({appId: appId});
                //   console.log('retrieveAppID', retrieveId)
                //   let identity = decryptSecretBox(retrieveId.identity);
  
                //   localStorage.setItem(appId + ":" + process.env.THREADDB_APPIDENTITY_STRING, identity.toString())
                //   localStorage.setItem(appId + ":" + process.env.THREADDB_APP_THREADID, retrieveId.threadId);
                //   return await PrivateKey.fromString(identity); 
                //  }
              } catch (err) {
                  console.log(err)
                 
                  /** No cached identity existed, so create a new one */
                  let identity = await PrivateKey.fromRandom()
                  
                  /** Add the string copy to the cache */
                  localStorage.setItem(appId + ":" + process.env.THREADDB_APPIDENTITY_STRING, identity.toString())

                  const challenge = Buffer.from(publicKey)
                  const credentials = identity.sign(challenge)
                    return credentials
                 // console.log('credentials ', credentials)
  
                //   /**Get encryption key*/
                //   let loginCallback = loginWithChallengeEK(identity);    
                //   let encKey = await Promise.resolve(loginCallback)
                //   let encryptionKey = encKey.enckey 
                //   parseEncryptionKeyNear(appId, type, encryptionKey);
                //   let encryptedId = encryptSecretBox(identity.toString());
                 
                //   const threadId = ThreadID.fromRandom();
                //   let stringThreadId = threadId.toString();
                //   localStorage.setItem(appId + ":" + process.env.THREADDB_APP_THREADID, stringThreadId);
                //   let status = 'active'
                //   console.log('GAS', process.env.DEFAULT_GAS_VALUE)
                //   await window.contract.setAppIdentity({appId: appId, identity: encryptedId, threadId: stringThreadId, status: status }, process.env.DEFAULT_GAS_VALUE);
  
                //   const newIdentity = await window.contract.getAppIdentity({appId: appId});
                //   console.log('New App Identity', newIdentity)
                //   let success = false
                //   while(!success) {
                //     let receipt = await window.contract.registerApp({appNumber: newIdentity.appNumber.toString() , appId: appId, appCreatedDate: new Date().getTime().toString(), status: status}, process.env.DEFAULT_GAS_VALUE);
                //     if(receipt) {
                //       success = true
                //     }
                //   }
                //   return PrivateKey.fromString(identity.toString()); 
              }
  //    }             
}


async function getIdentity(accountId) {
    const type = 'member'
    /** Restore any cached user identity first */
    const cached = localStorage.getItem(appId + ":" + process.env.THREADDB_IDENTITY_STRING)
    console.log('cached', cached)
    if (cached !== null) {
    /**Convert the cached identity string to a PrivateKey and return */
    return PrivateKey.fromString(cached)
    }

    /** Try and retrieve identity from contract if it exists */
    if (cached === null) {
            try {
                let tempIdentity = await PrivateKey.fromRandom()
                console.log('tempidentity', tempIdentity)
                const loginCallback = loginWithChallenge(tempIdentity);
                const db = Client.withUserAuth(loginCallback);
                console.log('db', db)
                const token = await db.getToken(tempIdentity)
                console.log('tempid', token)
                if(token) {
                /**Get encryption key*/
                let loginCallback = loginWithChallengeEK(tempIdentity);    
                let encKey = await Promise.resolve(loginCallback)
                let encryptionKey = encKey.enckey
                parseEncryptionKeyNear(accountId, type, encryptionKey);
                let retrieveId = await window.contract.getIdentity({account: accountId});
                console.log('retrieveID', retrieveId)
                let identity = decryptSecretBox(retrieveId.identity);
                
                localStorage.setItem(appId + ":" + process.env.THREADDB_IDENTITY_STRING, identity.toString())
                localStorage.setItem(appId + ":" + process.env.THREADDB_USER_THREADID, retrieveId.threadId);
                return await PrivateKey.fromString(identity); 
              }
            } catch (err) {
                console.log(err)
               
                /** No cached identity existed, so create a new one */
                let identity = await PrivateKey.fromRandom()
                
                /** Add the string copy to the cache */
                localStorage.setItem(appId + ":" + process.env.THREADDB_IDENTITY_STRING, identity.toString())

                /**Get encryption key*/
                let loginCallback = loginWithChallengeEK(identity);    
                let encKey = await Promise.resolve(loginCallback)
                let encryptionKey = encKey.enckey
                
                parseEncryptionKeyNear(accountId, type, encryptionKey);
                let encryptedId = encryptSecretBox(identity.toString());
               
                const threadId = ThreadID.fromRandom();
                let stringThreadId = threadId.toString();
                localStorage.setItem(appId + ":" + process.env.THREADDB_USER_THREADID, stringThreadId);
                let status = 'active'
                console.log(accountId, encryptedId, stringThreadId, status)
                console.log(window.contract)
                console.log('GAS', process.env.DEFAULT_GAS_VALUE)
                await window.contract.setIdentity({account: accountId, identity: encryptedId, threadId: stringThreadId, status: status }, process.env.DEFAULT_GAS_VALUE);

                const newIdentity = await window.contract.getIdentity({account: accountId});
                console.log('New Identity', newIdentity)
                let success = false
                while(!success) {
                  let receipt = await window.contract.registerMember({memberId: newIdentity.memberId.toString() , memberAccount: accountId, memberRole: 'member', memberJoinDate: new Date().getTime().toString(), status: status}, process.env.DEFAULT_GAS_VALUE);
                  if(receipt) {
                    success = true
                  }
                }
              
                return PrivateKey.fromString(identity.toString()); 
            }
    }             
}

async function getAppThreadId(appId) {

  /** Restore any cached user identity first */
  const cached = localStorage.getItem(appId + ":" + process.env.THREADDB_APP_THREADID)
  
  if (cached !== null) {
      return cached
  }

  /** Try and retrieve from contract if it exists */
  if (cached === null) {
          try {
              let retrieveId = await window.contract.getAppIdentity({threadId: appId});
              console.log('retrieve AppIdthread', retrieveId)
              let identity = decryptSecretBox(retrieveId);
              console.log('retrieved appthreadId decrypted', identity.threadId)
              return identity.threadId; 
          } catch (err) {
             console.log(err);
          }
  }             
}


async function getThreadId(accountId) {

    /** Restore any cached user identity first */
    const cached = localStorage.getItem(appId + ":" + process.env.THREADDB_USER_THREADID)
    
    if (cached !== null) {
        return cached
    }

    /** Try and retrieve from contract if it exists */
    if (cached === null) {
            try {
                let retrieveId = await window.contract.getIdentity({threadId: accountId});
                console.log('retrieveIdthread', retrieveId)
                let identity = decryptSecretBox(retrieveId);
                console.log('retrieved threadId decrypted', identity.threadId)
                return identity.threadId; 
            } catch (err) {
               console.log(err);
            }
    }             
}
const loginWithChallengeEK = (identity) => {
    // we pass identity into the function returning function to make it
    // available later in the callback
      return new Promise((resolve, reject) => {
        /** 
         * Configured for our development server
         * 
         * Note: this should be upgraded to wss for production environments.
         */
        const socketUrl = `wss://vpai.azurewebsites.net:443/ws/enckey`
        
        /** Initialize our websocket connection */
        const socket = new WebSocket(socketUrl)
  
        /** Wait for our socket to open successfully */
        socket.onopen = () => {
          /** Get public key string */
          const publicKey = identity.public.toString();

          socket.send(JSON.stringify({
              pubkey: publicKey,
              type: 'enckey'
          }));
  
          /** Listen for messages from the server */
          socket.onmessage = async (event) => {
             
            const data = JSON.parse(event.data)
            switch (data.type) {
              /** Error never happen :) */
              case 'error': {
                reject(data.value);
                break;
              }
            
              /** Enc Key Received */
              case 'enckey': {
                  resolve(data.value)
                  break;
              }
             
            }
          }
        }
        
      });

  }

const loginWithChallenge = (identity) => {
    // we pass identity into the function returning function to make it
    // available later in the callback
    return () => {
      return new Promise((resolve, reject) => {
        /** 
         * Configured for our development server
         * 
         * Note: this should be upgraded to wss for production environments.
         */
       
        const socketUrl = `wss://vpai.azurewebsites.net:443/ws/userauth`
        
        /** Initialize our websocket connection */
        const socket = new WebSocket(socketUrl)
  
        /** Wait for our socket to open successfully */
        socket.onopen = () => {
          /** Get public key string */
          const publicKey = identity.public.toString();
          console.log('publickey', publicKey)
          /** Send a new token request */
          socket.send(JSON.stringify({
            pubkey: publicKey,
            type: 'token'
          })); 
  
          /** Listen for messages from the server */
          socket.onmessage = async (event) => {
            const data = JSON.parse(event.data)
            console.log('data', data)
            switch (data.type) {
              /** Error never happen :) */
              case 'error': {
                reject(data.value);
                break;
              }
              /** The server issued a new challenge */
              case 'challenge':{
                /** Convert the challenge json to a Buffer */
                const buf = Buffer.from(data.value)
                /** User our identity to sign the challenge */
                const signed = await identity.sign(buf)
                /** Send the signed challenge back to the server */
                socket.send(JSON.stringify({
                  type: 'challenge',
                  sig: Buffer.from(signed).toJSON()
                })); 
                break;
              }
              /** New token generated */
              case 'token': {
                resolve(data.value)
                break;
              }
              
            }
       
          }
          
        }
        
      })
    }
  }

  const appLoginWithChallenge = (identity) => {
    // we pass identity into the function returning function to make it
    // available later in the callback
    return () => {
      return new Promise((resolve, reject) => {
        /** 
         * Configured for our development server
         * 
         * Note: this should be upgraded to wss for production environments.
         */
       
        const socketUrl = `wss://vpai.azurewebsites.net:443/ws/appauth`
        
        
        /** Initialize our websocket connection */
        const socket = new WebSocket(socketUrl)
  
        /** Wait for our socket to open successfully */
        socket.onopen = () => {
          /** Get public key string */
          const publicKey = identity.public.toString();
  
          /** Send a new token request */
          socket.send(JSON.stringify({
            pubkey: publicKey,
            type: 'token'
          })); 
  
          /** Listen for messages from the server */
          socket.onmessage = async (event) => {
            const data = JSON.parse(event.data)
            switch (data.type) {
              /** Error never happen :) */
              case 'error': {
                reject(data.value);
                break;
              }
              /** The server issued a new challenge */
              case 'challenge':{
                /** Convert the challenge json to a Buffer */
                const buf = Buffer.from(data.value)
                /** User our identity to sign the challenge */
                const signed = await identity.sign(buf)
                /** Send the signed challenge back to the server */
                socket.send(JSON.stringify({
                  type: 'challenge',
                  sig: Buffer.from(signed).toJSON()
                })); 
                break;
              }
              /** New token generated */
              case 'token': {
                resolve(data.value)
                break;
              }
       
            }
          }
        
        }
      });
    }
  }

  export async function initiateAppDB() {
    let type = 'app';
    const identity = await getAppIdentity(appId);
    console.log('app identity', identity)
    const threadId = await getAppThreadId(appId);
    const appdb = await tokenWakeUp(type)
 
    console.log('Verified App on Textile API');
    console.log('new app client', appdb);
    await appdb.getToken(identity)
    appDatabase = appdb
    console.log(JSON.stringify(appdb.context.toJSON()))
    try {
        await appdb.getDBInfo(ThreadID.fromString(threadId))
        appDbObj = {
            db: appdb,
            threadId: threadId
        }
    } catch (err) {
      console.log('threadId here', threadId)
      if(threadId){
        await appdb.newDB(ThreadID.fromString(threadId));
      }
        console.log('app DB created');
        appDbObj = {
            db: appdb,
            threadId: threadId
        }
    }
    return appDbObj
}

 

export async function initiateDB() {
    let type = 'member';
    console.log(window.currentUser)
    const identity = await getIdentity(window.currentUser.accountId);
    console.log('identity', identity)
    const threadId = await getThreadId(window.currentUser.accountId);
    const db = await tokenWakeUp(type)
    await db.getToken(identity)
    userDatabase = db
    console.log('Verified on Textile API');
    console.log('db', db)
   
    try {
        await db.getDBInfo(ThreadID.fromString(threadId))
        dbObj = {
            db: db,
            threadId: threadId
        }
    } catch (err) {
        await db.newDB(ThreadID.fromString(threadId));
        console.log('DB created');
        dbObj = {
            db: db,
            threadId: threadId
        }
    }
    return dbObj
}


export async function initiateAppCollection(collection, schema) {
  
  try {
      const r = await appDatabase.find(ThreadID.fromString(localStorage.getItem(appId + ":" + process.env.THREADDB_APP_THREADID)), collection, {})
      console.log('r :', r)
      console.log('found :', r.instancesList.length)    
      return r
  } catch (err) {
      console.log(err);
      await appDatabase.newCollection(ThreadID.fromString(localStorage.getItem(appId + ":" + process.env.THREADDB_APP_THREADID)), collection, schema);
      console.log('New collection created', collection);
  }
}


export async function initiateCollection(collection, schema) {

    try {
        const r = await userDatabase.find(ThreadID.fromString(localStorage.getItem(appId + ":" + process.env.THREADDB_USER_THREADID)), collection, {})
        console.log('r :', r)
        console.log('found :', r.instancesList.length)    
        return r
    } catch (err) {
        console.log(err);
        await userDatabase.newCollection(ThreadID.fromString(localStorage.getItem(appId + ":" + process.env.THREADDB_USER_THREADID)), collection, schema);
        console.log('New collection created', collection);
    }
}


export async function dataURItoBlob(dataURI)
{
    // convert base64/URLEncoded data component to raw binary data held in a string
    var byteString;

    if(dataURI.split(',')[0].indexOf('base64') >= 0)
        byteString = atob(dataURI.split(',')[1]);
    else
        byteString = unescape(dataURI.split(',')[1]);

    // separate out the mime component
    var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];

    // write the bytes of the string to a typed array
    var ia = new Uint8Array(byteString.length);
    for(var i = 0; i < byteString.length; i++)
    {
        ia[i] = byteString.charCodeAt(i);
    }

    return new Blob([ia], {type: mimeString});
}

export async function tokenWakeUp(type) {
  /** Use the identity to request a new API token when needed */
  console.log('type', type)
  if (type === 'member') {
    const identity = await getIdentity(window.currentUser.accountId);
    const loginCallback = loginWithChallenge(identity, type);
    const db = Client.withUserAuth(loginCallback);
    return db
  } else if (type ==='app' ) {
    const identity = await getAppIdentity(appId)
    const loginCallback = appLoginWithChallenge(identity, type);
    const db = Client.withUserAuth(loginCallback);
    return db
  }
}

export async function retrieveAppRecord(id, collection) {
  
  let obj
  console.log('appdatabase', appDatabase)
  console.log('collection', collection)
  console.log('id', id)
  try {
      let r = await appDatabase.findByID(ThreadID.fromString(localStorage.getItem(appId + ":" + process.env.THREADDB_APP_THREADID)), collection, id)
      console.log('record retrieved', r.instance);
      obj = r.instance
  } catch (err) {
      console.log('error', err)
      console.log('id does not exist')
  }
  return obj
}

export async function retrieveAppRecords(records, appdb, collection) {

  ////currently NOT USED

   let obj = []
   try {
    if (records.length > 0) {
      records.map(post => {
         console.log('news records map', post)
         console.log('post[0]', post[0])
         if(post[0]!=='' && post[3]!=='false') {
            let r = appdb.findByID(ThreadID.fromString(localStorage.getItem(appId + ":" + process.env.THREADDB_APP_THREADID)), collection, post[0])
            r.then((result) => {
              console.log('record retrieved', result.instance);
              obj.push([
                result.instance._id,
                result.instance.title
              ]
              )
            })
         }
      })
    }    
   } catch (err) {
       console.log('error', err)
       console.log('id does not exist')
   }
   console.log('object here', obj)
   return obj
 }

export async function retrieveRecord(id, collection) {

    let obj
    try {
        let r = await userDatabase.findByID(ThreadID.fromString(localStorage.getItem(appId + ":" + process.env.THREADDB_USER_THREADID)), collection, id)
        console.log('record retrieved', r.instance);
        obj = r.instance
    } catch (err) {
        console.log('error', err)
        console.log('id does not exist')
    }
    return obj
}

export async function createAppRecord(collection, record) {

  try {
     await appDatabase.create(ThreadID.fromString(localStorage.getItem(appId + ":" + process.env.THREADDB_APP_THREADID)), collection, [record])        
     console.log('success app record created')
  } catch (err) {
      console.log('error', err)
      console.log('there was a problem, app record not created')
  }
}

export async function createRecord(collection, record) {

    try {
       await userDatabase.create(ThreadID.fromString(localStorage.getItem(appId + ":" + process.env.THREADDB_USER_THREADID)), collection, [record])        
       console.log('success record created')
    } catch (err) {
        console.log('error', err)
        console.log('there was a problem, record not created')
    }
}

export async function updateAppRecord(collection, record) {
  
    try {
       await appDatabase.save(ThreadID.fromString(localStorage.getItem(appId + ":" + process.env.THREADDB_APP_THREADID)), collection, [record])        
       console.log('success app record updated')
    } catch (err) {
        console.log('error', err)
        console.log('there was a problem, app record not updated')
    }
  }
  
  export async function updateRecord(collection, record) {
  
      try {
         await userDatabase.save(ThreadID.fromString(localStorage.getItem(appId + ":" + process.env.THREADDB_USER_THREADID)), collection, [record])        
         console.log('success record updated')
      } catch (err) {
          console.log('error', err)
          console.log('there was a problem, record not updated')
      }
  }

  export async function hasAppRecord(collection, id) {
  
    try {
       await appDatabase.has(ThreadID.fromString(localStorage.getItem(appId + ":" + process.env.THREADDB_APP_THREADID)), collection, [id])        
       console.log('success app record found')
       return true
    } catch (err) {
        console.log('error', err)
        console.log('there was a problem, app record not found')
        return false
    }
  }
  
  export async function hasRecord(collection, id) {
  
      try {
        console.log('id to find', id)
         await userDatabase.has(ThreadID.fromString(localStorage.getItem(appId + ":" + process.env.THREADDB_USER_THREADID)), collection, [id])        
         console.log('success record found')
         return true
      } catch (err) {
          console.log('error', err)
          console.log('there was a problem, record not found')
          return false
      }
  }

export async function deleteAppRecord(id, collection) {

  try {
      await appDatabase.delete(ThreadID.fromString(localStorage.getItem(appId + ":" + process.env.THREADDB_APP_THREADID)), collection, [id])
      console.log('app record deleted')
  } catch (err) {
      console.log('error', err)
      console.log('there was an error deleting the app record')
  }
}


export async function deleteRecord(id, collection) {

    try {
        await userDatabase.delete(ThreadID.fromString(localStorage.getItem(appId + ":" + process.env.THREADDB_USER_THREADID)), collection, [id])
        console.log('record deleted')
    } catch (err) {
        console.log('error', err)
        console.log('there was an error deleting the record')
    }
}
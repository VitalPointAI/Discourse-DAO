import 'regenerator-runtime/runtime'
import 'fontsource-roboto';
import React, { useState, useEffect } from 'react'
import { providers, transactions, Account, utils, context } from 'near-api-js'
import { PrivateKey, ThreadID } from '@textile/hub'
import { getAppIdentity, generateIdentity, initiateDB, initiateAppDB } from './threadsDB'
import { makeStyles } from '@material-ui/core/styles'

// Material UI imports
import Typography from '@material-ui/core/Typography'
import LinearProgress from '@material-ui/core/LinearProgress'

// DApp component imports
import SignIn from './components/common/SignIn/signIn'
import Initialize from './components/Initialize/initialize'
import TokenData from './components/TokenData/tokenData'

// import stylesheets
import './global.css'
import { Provider } from 'near-api-js/lib/providers';

const BN = require('bn.js')
const sha256 = require('js-sha256')

const useStyles = makeStyles((theme) => ({
  root: {
   height: '100%',
   display: 'flex',
   justifyContent: 'center',
   alignItems: 'center'
  },
  }));

export default function App() {

  // state setup
  const [loggedIn, setLoginState] = useState(false)
  const [initialized, setInit] = useState(false)
  const [done, setDone] = useState(false)
  const [accountId, setAccountId] = useState()  
  const [tabValue, setTabValue] = useState('1')
  const [currentPeriod, setCurrentPeriod] = useState(0)
  const [proposalEvents, setProposalEvents] = useState([])
  const [summoner, setSummoner] = useState()
  const [tokenName, setTokenName] = useState()
  const [guildBalance, setGuildBalance] = useState()
  const [escrowBalance, setEscrowBalance] = useState()
  const [depositToken, setDepositToken] = useState('')
  const [memberStatus, setMemberStatus] = useState()
  const [userBalance, setUserBalance] = useState()
  const [memberInfo, setMemberInfo] = useState()
  const [proposalDeposit, setProposalDeposit] = useState()
  const [tributeToken, setTributeToken] = useState()
  const [processingReward, setProcessingReward] = useState()
  const [tributeOffer, setTributeOffer] = useState()
  const [periodDuration, setPeriodDuration] = useState()
  const [dbLoaded, setDBLoaded] = useState(false)
  const [proposalComments, setProposalComments] = useState([])

  const classes = useStyles()

  function handleInitChange(newState) {
    setInit(newState)
  }

  function handleSummonerChange(newSummoner) {
    setSummoner(newSummoner)
  }

  async function handleProposalEventChange() {
    try {
      let currentProposalEvents = await window.contract.getAllProposalEvents()
      if(currentProposalEvents){
        setProposalEvents(currentProposalEvents)
      }
      return true
    } catch (err) {
      return false
    }
  }

  async function handleGuildBalanceChanges() {
    try {
      let currentGuildBalance = await window.contract.getGuildTokenBalances()
      if(currentGuildBalance) {
        setGuildBalance(currentGuildBalance)
      }
      return true
    } catch (err) {
      return false
    }
  }

  async function handleUserBalanceChanges() {
    try {
      let currentUserBalance = await window.contract.getUserTokenBalance({user: accountId, token: depositToken})
      if(currentUserBalance) {
        setUserBalance(currentUserBalance)
      }
      return true
    } catch (err) {
      return false
    }
  }

  async function handleEscrowBalanceChanges() {
    try {
      let currentEscrowBalance = await window.contract.getEscrowTokenBalances()
      if(currentEscrowBalance) {
        setEscrowBalance(currentEscrowBalance)
      }
      return true
    } catch (err) {
      return false
    }
  }

  function handleTabValueState(value) {
    setTabValue(value)
  }

  function formatAmount(amount){
    return BigInt(utils.format.parseNearAmount(amount.toString()))
  }

  async function deleteUserAccountAccessKey() {

    const currentUserAccount = await near.account(window.accountId)
    console.log('account ', currentUserAccount)
    console.log('account ', await currentUserAccount.getAccessKeys())
    let allAccessKeys = await currentUserAccount.getAccessKeys()
    let aCurrentUserPublicKey
    allAccessKeys.forEach(key => {
      if(key.access_key.permission == 'FullAccess'){
        aCurrentUserPublicKey = key.public_key
        console.log('userpublickey ',aCurrentUserPublicKey)
        console.log('key ', key)
      }
    })

    let currentUserKey = window.localStorage.getItem('near-api-js:keystore:' + window.accountId + ':' + window.walletConnection._networkId)
    console.log('current user key ', currentUserKey)
    
    const currentUserKeyPair = utils.key_pair.KeyPair.fromString(currentUserKey)
    console.log('current user key pair', currentUserKeyPair)

   // const fullAccessKeyPair = utils.key_pair.KeyPair.fromString(aCurrentUserPublicKey)
   // console.log('full access key pair ', fullAccessKeyPair)

    const currentUserKeyPublicKey = currentUserKeyPair.getPublicKey()
    console.log('current user key public key here ', currentUserKeyPublicKey.toString())
    
    const sender = window.accountId
    
    const receiver = window.accountId
   
    //const currentUserFullAccessPublicKey = utils.PublicKey.fromString(aCurrentUserPublicKey)
    //console.log('currentUserFullAccessPublicKey ', currentUserFullAccessPublicKey.toString())

    const currentUserAccessKey = await provider.query(`access_key/${sender}/${currentUserKeyPublicKey.toString()}`, '')
    console.log('current user accessKey ', currentUserAccessKey)

    const userKeyNonce = ++currentUserAccessKey.nonce
    console.log('user key nonce ', userKeyNonce)

    const actions = [
        transactions.deleteKey(currentUserKeyPublicKey),
     // transactions.addKey(currentUserKeyPublicKey, functionAccessKey)
     //transactions.addKey(daoPublicKey, fullAccessKey)
     //transactions.addKey(currentUserKeyPublicKey, fullAccessKey)
    ]

    const recentBlockHash = utils.serialize.base_decode(currentUserAccessKey.block_hash)
    console.log('recentBlockhash ', recentBlockHash)

    const transaction = transactions.createTransaction(
      sender,
      currentUserKeyPublicKey,
      receiver,
      userKeyNonce,
      actions,
      recentBlockHash
    )

    const serializedTx = utils.serialize.serialize(
      transactions.SCHEMA,
      transaction
    )

    const serializedTxHash = new Uint8Array(sha256.sha256.array(serializedTx))
    console.log('serializedTx hash ', serializedTxHash)

    const signature = currentUserKeyPair.sign(serializedTxHash)

    const signedTransaction = new transactions.SignedTransaction({
      transaction,
      signature: new transactions.Signature({
        keyType: transaction.publicKey.keyType,
        data: signature.signature
      })
    })

    // send the transaction!
    try {
      // encodes signed transaction to serialized Borsh (required for all transactions)
      const serializedTx = signedTransaction.encode();
      // sends transaction to NEAR blockchain via JSON RPC call and records the result
      const result = await provider.sendJsonRpc(
        'broadcast_tx_commit', 
        [Buffer.from(serializedTx).toString('base64')]
        );
      // console results :)
      console.log('Transaction Results: ', result.transaction);
    } catch (error) {
      console.log(error);
    };
  }

  async function setAccountAccessKey() {
    const daoKeyPair = utils.key_pair.KeyPair.fromString(process.env.PRIVATE_KEY)
    console.log('keypair ', daoKeyPair)

    const currentUserAccount = await near.account(window.accountId)
    console.log('account ', currentUserAccount)
    console.log('account ', await currentUserAccount.getAccessKeys())
    let allAccessKeys = await currentUserAccount.getAccessKeys()
    let aCurrentUserPublicKey
    allAccessKeys.forEach(key => {
      if(key.access_key.permission == 'FullAccess'){
        aCurrentUserPublicKey = key.public_key
        console.log('userpublickey ',aCurrentUserPublicKey)
        console.log('key ', key)
      }
    })

    let currentUserKey = window.localStorage.getItem('near-api-js:keystore:' + window.accountId + ':' + window.walletConnection._networkId)
    console.log('current user key ', currentUserKey)
    
    const currentUserKeyPair = utils.key_pair.KeyPair.fromString(currentUserKey)
    console.log('current user key pair', currentUserKeyPair)

    const currentUserKeyPublicKey = currentUserKeyPair.getPublicKey()
    console.log('current user key public key here ', currentUserKeyPublicKey.toString())
    
    const sender = 'dao1.vitalpointai.testnet'
    
    const receiver = window.accountId
   
    const daoPublicKey = daoKeyPair.getPublicKey()
    console.log('public key of dao ', daoPublicKey.toString())

    const currentUserFullAccessPublicKey = utils.PublicKey.fromString(aCurrentUserPublicKey)
    console.log('currentUserFullAccessPublicKey ', currentUserFullAccessPublicKey.toString())

    const daoAccessKey = await provider.query(`access_key/${sender}/${daoPublicKey.toString()}`, '')
    console.log('dao accessKey ', daoAccessKey)

    const currentUserAccessKey = await provider.query(`access_key/${receiver}/${currentUserFullAccessPublicKey.toString()}`, '')
    console.log('current user accessKey ', currentUserAccessKey)
  
    const nonce = ++daoAccessKey.nonce
    console.log('nonce ', nonce)

    const userKeyNonce = ++currentUserAccessKey.nonce

    //const newKeyPair = utils.KeyPairEd25519.fromRandom()
    console.log('new Key pair ', newKeyPair)

    const contractName = 'dao1.vitalpointai.testnet'
    const methodNames = [
      "submitProposal",
      "sponsorProposal",
      "submitVote",
      "processProposal"
    ]
    let allowance = '40000000000000'

    const functionAccessKey =  transactions.functionCallAccessKey(
      contractName, 
      methodNames,
      allowance)

    const fullAccessKey = transactions.fullAccessKey()
    functionAccessKey.nonce = userKeyNonce

   console.log('function Access Key ', functionAccessKey)

    const actions = [
    // transactions.deleteKey(currentUserKeyPublicKey),
   //   transactions.createAccount(),
      transactions.addKey(newKeyPair.publicKey, functionAccessKey)
     //transactions.addKey(daoPublicKey, fullAccessKey)
     //transactions.addKey(currentUserKeyPublicKey, fullAccessKey)
    ]

    const recentBlockHash = utils.serialize.base_decode(daoAccessKey.block_hash)
    console.log('recentBlockhash ', recentBlockHash)

    const transaction = transactions.createTransaction(
      sender,
      daoPublicKey,
      receiver,
      nonce,
      actions,
      recentBlockHash
    )

    const serializedTx = utils.serialize.serialize(
      transactions.SCHEMA,
      transaction
    )

    const serializedTxHash = new Uint8Array(sha256.sha256.array(serializedTx))
    console.log('serializedTx hash ', serializedTxHash)

    const signature = daoKeyPair.sign(serializedTxHash)

    const signedTransaction = new transactions.SignedTransaction({
      transaction,
      signature: new transactions.Signature({
        keyType: transaction.publicKey.keyType,
        data: signature.signature
      })
    })

    // send the transaction!
    try {
      // encodes signed transaction to serialized Borsh (required for all transactions)
      const serializedTx = signedTransaction.encode();
      // sends transaction to NEAR blockchain via JSON RPC call and records the result
      const result = await provider.sendJsonRpc(
        'broadcast_tx_commit', 
        [Buffer.from(serializedTx).toString('base64')]
        );
      // console results :)
      console.log('Transaction Results: ', result.transaction);
    } catch (error) {
      console.log(error);
    };
  }

  async function textileCredential() {
    let currentUserKey = window.localStorage.getItem('near-api-js:keystore:' + window.accountId + ':' + window.walletConnection._networkId)
    console.log('current user key ', currentUserKey.substr(8,))
    
    const currentUserKeyPair = utils.key_pair.KeyPair.fromString(currentUserKey)
    console.log('current user key pair', currentUserKeyPair)

    const currentUserKeyPublicKey = currentUserKeyPair.getPublicKey()
    console.log('current user key public key here ', currentUserKeyPublicKey.toString())

    return currentUserKeyPublicKey
    

    //const keyToUse = new Uint8Array(currentUserKey.substr(8,))
    const array = Uint8Array.from(currentUserKey.substr(8,))
    console.log('array ', array)

    /** Random new identity */
   const identity = await PrivateKey.fromRandom()
   console.log('identity ', identity)

  // const key = await PrivateKey.fromString(keyToUse)
  // console.log('key ', key)

   const id = identity.toString()
   console.log('identity ', id)
  }

  

  // The useEffect hook can be used to fire side-effects during render
  // Learn more: https://reactjs.org/docs/hooks-intro.html
  useEffect(
      () => {
      // in this case, we only care to query the contract when signed in
      if (window.walletConnection.isSignedIn()) {
        
        setLoginState(true)
        setAccountId(window.accountId)
        console.log('wallet ', window.walletConnection)
              
        async function fetchData() {

          setDBLoaded(false)
          let userDB = await initiateDB()
          let appDB = await initiateAppDB()
          
      //    console.log('userdb ', userDB)
      //    console.log('appdb ', appDB)

       //   let userDBInfo = await userDB.db.getDBInfo(ThreadID.fromString(userDB.threadId))
       //   console.log('userdbinfo ', userDBInfo)
         
          // try {
          //  // let userDBCollectionInfo = await userDB.db.getCollectionInfo(ThreadID.fromString(userDB.threadId))
          //  let appId = 'vpdao'
          //  let userDBCollectionInfo = await userDB.db.findByID(ThreadID.fromString(localStorage.getItem(appId + ":" + process.env.THREADDB_USER_THREADID)), 'MemberProposal', '0')
          //   console.log('userdb collection info ', userDBCollectionInfo)
          // } catch (err) {
          //   console.log(err)
          // }

          // let appDBInfo = await appDB.db.getDBInfo(ThreadID.fromString(appDB.threadId))
          // console.log('appdbinfo ', appDBInfo)

          // try {
          //   let appDBCollectionInfo = await appDB.db.getCollectionInfo(ThreadID.fromString(appDB.threadId))
          //   console.log('appdb collection info ', appDBCollectionInfo)
          // } catch (err) {
          //   console.log(err)
          // }


          const provider = await window.provider
          console.log('provider ', provider)
          
        //  await deleteUserAccountAccessKey()
    //    await setAccountAccessKey()
    //   const publicKey = await textileCredential()
    //   console.log('publicKey ', publicKey)
    //   let credentials = await getAppIdentity(publicKey)
    //   console.log('credentials app ', credentials)

    //   let identity = await generateIdentity()
    //   console.log('identity ', identity)

          try {         
              try {
                let result = await window.contract.getMemberStatus({member: window.accountId})
                setMemberStatus(result)
              } catch (err) {
                console.log('no member status yet')
                return false
              }

              try {
                let token = await window.contract.getDepositToken()
                setDepositToken(token)
              } catch (err) {
                console.log('no deposit token yet')
                return false
              }
              
              try {
                let deposit = await window.contract.getProposalDeposit()
                setProposalDeposit(deposit)
              } catch (err) {
                console.log('no proposal deposit yet')
                return false
              }

              try {
                let reward = await window.contract.getProcessingReward()
                setProcessingReward(reward)
              } catch (err) {
                console.log('no processing reward yet')
                return false
              }

              try {
                let duration = await window.contract.getPeriodDuration()
                setPeriodDuration(duration)
              } catch (err) {
                console.log('no period duration yet')
                return false
              }
               
              try {
                let result1 = await window.contract.getUserTokenBalance({user: window.accountId, token: depositToken})
                setUserBalance(result1)
              } catch (err) {
                console.log('no user token balance yet')
                return false
              }

              try {
                let result2 = await window.contract.getMemberInfo({member: window.accountId})
                setMemberInfo(result2)
              } catch (err) {
                console.log('no member info yet')
                return false
              }
          
              try {
                let owner = await window.contract.getSummoner()
                setSummoner(owner)
              } catch (err) {
                console.log('no summoner yet')
                return false
              }
            } catch (err) {
              setDone(false)
              return false
            }
          return true
        }

        fetchData()
          .then((res) => {
            console.log('res', res)
            res ? setInit(true) : setInit(false)
            setDone(true)
            setDBLoaded(true)
        })


        async function fetchEscrowBalances() {
          try {
            let balance = await window.contract.getEscrowTokenBalances()
            setEscrowBalance(balance)
          } catch (err) {
            console.log('no escrow balance')
            return false
          }
        }

        fetchEscrowBalances()
        .then((res) => {
          console.log('escrow balances exist', res)
        })

        async function fetchAllComments() {
          let allComments = await window.contract.getAllComments()
          console.log('all comments', allComments)
              setProposalComments(allComments)
        }

        fetchAllComments()
        .then((res) => {
          console.log('comments exist', res)
        })


        async function fetchGuildBalances() {
          try {
           let balance = await window.contract.getGuildTokenBalances()
           setGuildBalance(balance)
         } catch (err) {
           console.log('no guild balance')
           return false
         }
        }

        fetchGuildBalances()
          .then((res) => {
            console.log('guild balances exist', res)
        })


        async function fetchProposalData() {
          try {
            let requests = await window.contract.getAllProposalEvents()
            console.log('proposals ', requests)
            if(requests.length != 0) {
              setProposalEvents(requests)
            }
          } catch (err) {
            console.log('error retrieving proposal events')
            return false
          }
        }
        
        fetchProposalData()
          .then((res) => {
            console.log('proposal events exist', res)
        })
     
      }
    },

    // The second argument to useEffect tells React when to re-run the effect
    // it compares current value and if different - re-renders
    [initialized]
  )

  // if not signed in, return early with sign-in component
  if (!window.walletConnection.isSignedIn()) {
    
    return (<SignIn />)
  }

  async function getCurrentPeriod() {
    let period = await window.contract.getCurrentPeriod()
    setCurrentPeriod(period)
  }

  if(initialized) {
    window.setInterval(getCurrentPeriod, 1000)
  }

  // if not done loading all the data, show a progress bar, otherwise show the content

  if(!done) {
    return (
      <div>
      <Typography component="h2">Just setting things up, please wait a moment.</Typography>
      <LinearProgress  />
      </div>
    )
  } else {
    if(!initialized) {
      return (
        <Initialize
          accountId={accountId}
          done={done} 
          handleInitChange={handleInitChange} 
          initialized={initialized}
        />
      )
    } else {
      return (
        <TokenData
          handleSummonerChange={handleSummonerChange}
          done={done}
          guildBalance={guildBalance}
          escrowBalance={escrowBalance}
          tabValue={tabValue}
          handleTabValueState={handleTabValueState}
          accountId={accountId}
          userBalance={userBalance}
          handleProposalEventChange={handleProposalEventChange}
          handleEscrowBalanceChanges={handleEscrowBalanceChanges}
          handleGuildBalanceChanges={handleGuildBalanceChanges}
          handleUserBalanceChanges={handleUserBalanceChanges}
          currentPeriod={currentPeriod}
          periodDuration={periodDuration}
          memberStatus={memberStatus}
          memberInfo={memberInfo}
          tokenName='VPC'
          proposalEvents={proposalEvents}
          depositToken={depositToken}
          tributeToken={tributeToken}
          tributeOffer={tributeOffer}
          processingReward={processingReward}
          proposalDeposit={proposalDeposit}
          proposalComments={proposalComments}
          summoner={summoner}

          />
      )
    }
  }
}

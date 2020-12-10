  

import { Context, storage, logging, env, u128, ContractPromise, PersistentVector, PersistentMap, ContractPromiseBatch } from "near-sdk-as"
import { 
  AccountId, 
  PeriodDuration, 
  VotingPeriodLength, 
  GracePeriodLength, 
  ProposalDeposit, 
  DilutionBound, 
  ProcessingReward,
  MinSharePrice
} from './dao-types'
import { 
  userTokenBalances,
  members,
  memberAddressByDelegatekey,
  tokenWhiteList,
  Member,
  TransferFromArgs,
  IncAllowanceArgs,
  BalanceArgs,
  Proposal,
  proposals,
  proposalQueue,
  proposedToWhiteList,
  proposedToKick,
  approvedTokens,
  userTokenBalanceInfo,
  votesByMember,
  Votes,
  TokenBalances,
  AppMetaData,
  AppIdentity,
  App,
  UserIdentity,
  daoMember,
  daoMemberMetaData,
  daoMembersArray,
  Comment,
  comments,
  indivComments
 } from './dao-models'

import {
  ERR_DAO_ALREADY_INITIALIZED,
  ERR_MUSTBE_GREATERTHAN_ZERO,
  ERR_MUSTBELESSTHAN_MAX_VOTING_PERIOD_LENGTH,
  ERR_MUSTBELESSTHAN_MAX_GRACE_PERIOD_LENGTH,
  ERR_DILUTIONBOUND_ZERO,
  ERR_DILUTIONBOUND_LIMIT,
  ERR_APPROVEDTOKENS,
  ERR_TOO_MANY_TOKENS,
  ERR_PROPOSAL_DEPOSIT,
  ERR_DUPLICATE_TOKEN,
  ERR_TOO_MANY_SHARES,
  ERR_NOT_WHITELISTED,
  ERR_NOT_WHITELISTED_PT,
  ERR_ALREADY_WHITELISTED,
  ERR_TOO_MANY_WHITELISTED,
  ERR_WHITELIST_PROPOSED,
  ERR_PROPOSED_KICK,
  ERR_NOT_SHAREHOLDER,
  ERR_CANNOT_SPONSOR_MORE,
  ERR_RESERVED,
  ERR_CANNOT_RAGEQUIT,
  ERR_JAILED,
  ERR_MUST_MATCH,
  ERR_DUPLICATE_PROPOSAL,
  ERR_ALREADY_SPONSORED,
  ERR_FULL_GUILD_BANK,
  ERR_ALREADY_MEMBER,
  ERR_GREATER_ZERO_TOTALSHARES,
  ERR_TRIBUTE_TRANSFER_FAILED,
  ERR_PROPOSALDEPOSIT_TRANSFER_FAILED,
  ERR_NOT_RIGHT_PROPOSAL,
  ERR_NO_OVERWRITE_KEY,
  ERR_NO_OVERWRITE_MEMBER,
  ERR_PROPOSAL_PROCESSED,
  ERR_PREVIOUS_PROPOSAL,
  ERR_SHAREORLOOT,
  ERR_INSUFFICIENT_SHARES,
  ERR_INSUFFICIENT_LOOT,
  ERR_WHITELIST_PROPOSAL,
  ERR_PROPOSAL_NO,
  ERR_PROPOSAL_CANCELLED,
  ERR_NOT_DELEGATE,
  ERR_VOTE_INVALID,
  ERR_ALREADY_VOTED,
  ERR_ALREADY_CANCELLED,
  ERR_ONLY_PROPOSER,
  ERR_VOTING_PERIOD_EXPIRED,
  ERR_VOTING_NOT_STARTED,
  ERR_STANDARD_PROPOSAL,
  ERR_GUILD_PROPOSAL,
  ERR_HAVE_LOOT,
  ERR_IN_JAIL,
  ERR_NOT_READY,
  ERR_INVALID_ACCOUNT_ID,
  ERR_INSUFFICIENT_BALANCE,
  ERR_NOT_A_MEMBER
} from './dao-error-messages'

import {
  summonCompleteEvent,
  sPE,
  SPE,
  submitProposalEvents,
  sponsorProposalEvent,
  submitVoteEvent,
  processProposalEvent,
  processWhiteListProposalEvent,
  processGuildKickProposalEvent,
  rageQuitEvent,
  RageQuitEvent,
  tokensCollectedEvent,
  cancelProposalEvent,
  CancelProposalEvent,
  updateDelegateKeyEvent,
  withdrawlEvent,
} from './dao-events'

// App Database Structures
// store app identities
let appIdentity = new PersistentMap<string, AppIdentity>("ai");
let apps = new PersistentVector<string>("a");
let appProfile = new PersistentMap<string, AppMetaData>("ad");

// store user identity
let userIdentity = new PersistentMap<string, UserIdentity>("ui");
let daoMembers = new PersistentVector<string>("dm");
let daoMemberProfile = new PersistentMap<string, daoMemberMetaData>("md");

// HARD-CODED LIMITS
// These numbers are quite arbitrary; they are small enough to avoid overflows when doing calculations
// with periods or shares, yet big enough to not limit reasonable use cases.
const MAX_VOTING_PERIOD_LENGTH: i32 = 10**8 // maximum length of voting period
const MAX_GRACE_PERIOD_LENGTH:i32 = 10**8 // maximum length of grace period
const MAX_DILUTION_BOUND: i32 = 10**8 // maximum dilution bound
const MAX_NUMBER_OF_SHARES_AND_LOOT: i32 = 10**8 // maximum number of shares that can be minted
const MAX_TOKEN_WHITELIST_COUNT: i32 = 400 // maximum number of whitelisted tokens
const MAX_TOKEN_GUILDBANK_COUNT: i32 = 200 // maximum number of tokens with non-zero balance in guildbank
const MOLOCH_CONTRACT_ACCOUNT: AccountId = 'discourse-dao.vitalpointai.testnet'; // DAO accountId

// *******************
// INTERNAL ACCOUNTING
// *******************

let totalShares: i32 = 0 // total shares across all members
let totalLoot: i32 = 0 // total loot across all members
let usedGas: u64 //accumulating gas
let usedStorage: u64 //accumulating storage

let totalGuildBankTokens: i32 // total tokens with non-zero balance in guild bank

let depositToken: AccountId
let gProposalDeposit: i32
let gProcessingReward: i32
let gVotingPeriodLength: i32
let gGracePeriodLength: i32


const GUILD: AccountId = 'guild.vitalpointai.testnet'
const ESCROW: AccountId = 'escrow.vitalpointai.testnet'
const TOTAL: AccountId = 'total.vitalpointai.testnet'

// ********************
// App Setup
// ********************

// Create new Identity for App
export function setAppData(app: App): void {
  let _appNumber = getAppData(app.appNumber);
  logging.log('setting member data')
  logging.log(_appNumber)
  if(_appNumber == null) {
    _appNumber = new Array<string>();
    _appNumber.push(app.appNumber); 
    _appNumber.push(app.appId);
    _appNumber.push(app.appCreatedDate);
    _appNumber.push(app.status);
    logging.log(_appNumber)
  } else {
    let present = false;
    let appNumberLength = _appNumber.length
    let i = 0
    while (i < appNumberLength) {
      if (_appNumber[0] == app.appNumber) {
        present = true;
        break;
      }
      i++
    }
    if (!present) {
      _appNumber.push(app.appNumber); 
      _appNumber.push(app.appId);
      _appNumber.push(app.appCreatedDate);
      _appNumber.push(app.status);
    }
  }
  let appData = new AppMetaData();
  appData.applog = _appNumber;
  appProfile.set(app.appNumber, appData);
  logging.log(appProfile);
  logging.log(app.appNumber);
  logging.log(appData);
}

function _addNewApp(appNumber: string): void {
  let present = false;
  let appLength = apps.length
  let i = 0
  while (i < appLength ) {
    if (apps[i] == appNumber) {
      present = true;
    }
    i++
  }
  if (!present) {
    apps.push(appNumber);
  }
}

export function getAppData(appNumber: string): Array<string> {
  let app = appProfile.get(appNumber);
  logging.log('getting app data')
  logging.log(app)
  if(!app) {
    return new Array<string>();
  }
  let appData = app.applog;
  return appData;
}

export function setAppIdentity(appId: string, identity: string, threadId: string, status: string): void {
  let present = false;
  logging.log('apps vector');
  logging.log(apps);
  let appsLength = apps.length
  let i = 0
  while (i < appsLength) {
    if (apps[i] == appId) {
      present = true;
      break;
    }
    i++
  }
    if (!present) {
      let thisAppNumber = appsLength + 1;
      let newAppIdentity = new AppIdentity();
      newAppIdentity.appId = appId;
      newAppIdentity.identity = identity;
      newAppIdentity.threadId = threadId;
      newAppIdentity.appNumber = thisAppNumber.toString();
      newAppIdentity.status = status;
      appIdentity.set(appId, newAppIdentity);
    } else {
      logging.log('app already has an identity set');
    }
}

export function getAppIdentity(appId: string): AppIdentity {
  let identity = appIdentity.getSome(appId);
  logging.log('getting app identity');
  logging.log(identity);
  return identity;
}

export function registerApp(
  appNumber: string,
  appId: string,
  appCreatedDate: string,
  status: string
  ): App {
  logging.log("registering app");
  return _registerApp(
    appNumber,
    appId,
    appCreatedDate,
    status
  );
  }
  
function _registerApp(
  appNumber: string,
  appId: string,
  appCreatedDate: string,
  status: string
): App {
  logging.log("start registering new app");
  let app = new App();
  app.appNumber = appNumber;
  app.appId = appId;
  app.appCreatedDate = appCreatedDate;
  app.status = status;
  setAppData(app);
  _addNewApp(appId);
  logging.log("registered new app");
  return app;
}

// Create new User Identities for ThreadsDB
  
export function setIdentity(account: string, identity: string, threadId: string, status: string): void {
  let present = false;
  logging.log('members vector');
  logging.log(daoMembers);
  let daoMembersLength = daoMembers.length
  let i = 0
  while (i < daoMembersLength) {
    if (daoMembers[i] == account) {
      present = true;
      break;
    }
    i++
  }
    if (!present) {
      let thisMemberId = daoMembersLength + 1;
      let newId = new UserIdentity();
      newId.account = account;
      newId.identity = identity;
      newId.threadId = threadId;
      newId.memberId = thisMemberId.toString();
      newId.status = status;
      userIdentity.set(Context.sender, newId);
    } else {
      logging.log('member already has an identity set');
    }
}

export function getIdentity(account: string): UserIdentity {
  let identity = userIdentity.getSome(account);
  logging.log('getting identity');
  logging.log(identity);
  return identity;
}

export function registerMember(
  memberId: string,
  memberAccount: string,
  memberRole: string,
  memberJoinDate: string,
  status: string
  ): daoMember {
  logging.log("registering member");
  return _registerMember(
    memberId,
    memberAccount,
    memberRole,
    memberJoinDate,
    status
  );
}

function _registerMember(
  memberId: string,
  memberAccount: string,
  memberRole: string,
  memberJoinDate: string,
  status: string
): daoMember {
  logging.log("start registering new dao member");
  let member = new daoMember();
  member.memberId = memberId;
  member.memberAccount = memberAccount;
  member.memberRole = memberRole;
  member.memberJoinDate = memberJoinDate;
  member.status = status;
  setDaoMemberData(member);
  _addNewDaoMember(memberId);
  logging.log("registered new dao member");
  return member;
}

export function setDaoMemberData(member: daoMember): void {
  let _memberId = getDaoMemberData(member.memberId);
  logging.log('setting dao member data')
  logging.log(_memberId)
  if(_memberId == null) {
    _memberId = new Array<string>();
    _memberId.push(member.memberId); 
    _memberId.push(member.memberAccount);
    _memberId.push(member.memberRole);
    _memberId.push(member.memberJoinDate);
    _memberId.push(member.status);
    logging.log(_memberId)
  } else {
    let present = false;
    let _memberIdLength = _memberId.length
    let i = 0
    while (i < _memberIdLength) {
      if (_memberId[0] == member.memberId) {
        present = true;
        break;
      }
      i++
    }
    if (!present) {
    _memberId.push(member.memberId);
    _memberId.push(member.memberAccount);
    _memberId.push(member.memberRole);
    _memberId.push(member.memberJoinDate);
    _memberId.push(member.status);
    }
  }
  let memberData = new daoMemberMetaData();
  memberData.memberlog = _memberId;
  daoMemberProfile.set(member.memberId, memberData);
  logging.log(daoMemberProfile);
  logging.log(member.memberId);
  logging.log(memberData);
}

function _addNewDaoMember(memberId: string): void {
  let present = false;
  let daoMembersLength = daoMembers.length
  let i = 0
  while (i < daoMembersLength) {
    if (daoMembers[i] == memberId) {
      present = true;
    }
    i++
  }
  if (!present) {
    daoMembers.push(memberId);
  }
}

export function getDaoMemberData(memberId: string): Array<string> {
  let member = daoMemberProfile.get(memberId);
  logging.log('getting dao member data')
  logging.log(member)
  if(!member) {
    return new Array<string>();
  }
  let memberData = member.memberlog;
  return memberData;
}

// ********************
// MODIFIERS
// ********************

/**
* Returns the owner (summoner) which we use in multiple places to confirm user has access to 
* do whatever they are trying to do.
* @param owner 
*/
export function isOwner(summoner: AccountId): boolean {
  assert(env.isValidAccountID(summoner), ERR_INVALID_ACCOUNT_ID)
  return summoner == storage.getSome<string>("summoner")
}

/**
* Returns the shareholder which we use in multiple places to confirm user has access to 
* do whatever they are trying to do.
* @param shareholder
*/
export function onlyShareholder(shareholder: AccountId): boolean {
  assert(env.isValidAccountID(shareholder), ERR_INVALID_ACCOUNT_ID)
  assert(members.get(shareholder)!=null, ERR_NOT_A_MEMBER)
  let shareholderExists = members.getSome(shareholder)
  return shareholderExists.shares > 0 ? true : false
}

/**
* Returns the member which we use in multiple places to confirm user has access to 
* do whatever they are trying to do.
* @param member 
*/
export function onlyMember(member: AccountId): boolean {
  assert(env.isValidAccountID(member), ERR_INVALID_ACCOUNT_ID)
  assert(members.get(member)!=null, ERR_NOT_A_MEMBER)
  let memberExists = members.getSome(member);
  return memberExists.shares > 0 || memberExists.loot > 0 ? true : false
}

/**
* Returns the delegate which we use in multiple places to confirm user has access to 
* do whatever they are trying to do.
* @param delegate
*/
export function onlyDelegate(delegate: AccountId): boolean {
  assert(env.isValidAccountID(delegate), ERR_INVALID_ACCOUNT_ID)
  assert(memberAddressByDelegatekey.get(delegate)!=null, ERR_NOT_DELEGATE)
  let memberDelegateExists = members.getSome(delegate)
  return memberDelegateExists.shares > 0 ? true : false
}

/**
 * Init function that summons a new DAO into existence
 * @param summoner 
 * @param approvedTokens
 * @param periodDuration
 * @param votingPeriodLength
 * @param gracePeriodLength
 * @param proposalDeposit
 * @param dilutionBound
 * @param processingReward
 * @param minSharePrice
 */

export function init(
    _approvedTokens: Array<string>,
    _periodDuration: PeriodDuration,
    _votingPeriodLength: VotingPeriodLength,
    _gracePeriodLength: GracePeriodLength,
    _proposalDeposit: ProposalDeposit,
    _dilutionBound: DilutionBound,
    _processingReward: ProcessingReward,
    _minSharePrice: MinSharePrice
): boolean {
  assert(storage.get<string>("init") == null, ERR_DAO_ALREADY_INITIALIZED)
  assert(_periodDuration > 0, ERR_MUSTBE_GREATERTHAN_ZERO)
  assert(_votingPeriodLength > 0, ERR_MUSTBE_GREATERTHAN_ZERO)
  assert(_votingPeriodLength <= MAX_VOTING_PERIOD_LENGTH, ERR_MUSTBELESSTHAN_MAX_VOTING_PERIOD_LENGTH)
  assert(_gracePeriodLength <= MAX_GRACE_PERIOD_LENGTH, ERR_MUSTBELESSTHAN_MAX_GRACE_PERIOD_LENGTH)
  assert(_dilutionBound > 0, ERR_DILUTIONBOUND_ZERO)
  assert(_dilutionBound <= MAX_DILUTION_BOUND, ERR_DILUTIONBOUND_LIMIT)
  assert(_approvedTokens.length > 0, ERR_APPROVEDTOKENS)
  assert(_approvedTokens.length <= MAX_TOKEN_WHITELIST_COUNT, ERR_TOO_MANY_TOKENS)
  assert(_proposalDeposit >= _processingReward, ERR_PROPOSAL_DEPOSIT)
  assert(_minSharePrice > 0, ERR_MUSTBE_GREATERTHAN_ZERO)

 //depositToken = _approvedTokens[0]
depositToken = 'NEAR'

 // storage.set<string>('depositToken', depositToken)
 storage.set<string>('depositToken', depositToken)

  for (let i: i32 = 0; i < _approvedTokens.length; i++) {
    if (i == 0) {
      tokenWhiteList.set(depositToken, true)
      approvedTokens.push(depositToken)
    } else {
      assert(env.isValidAccountID(_approvedTokens[i]), ERR_INVALID_ACCOUNT_ID)
      if(tokenWhiteList.contains(_approvedTokens[i])) {
        assert(!tokenWhiteList.getSome(_approvedTokens[i]), ERR_DUPLICATE_TOKEN)
      } else {
        tokenWhiteList.set(_approvedTokens[i], true)
      }   
      approvedTokens.push(_approvedTokens[i])
    }
  }
  
  //set Summoner
  storage.set<string>('summoner', Context.predecessor)

  //set periodDuration
  
  storage.set<i32>('periodDuration', _periodDuration)

  //set votingPeriodLength
  storage.set<i32>('votingPeriodLength', _votingPeriodLength)

  //set gracePeriodLength
  storage.set<i32>('gracePeriodLength', _gracePeriodLength)

  //set proposalDeposit
  storage.set<i32>('proposalDeposit', _proposalDeposit)

  //set dilutionBound
  storage.set<i32>('dilutionBound', _dilutionBound)

  //set processingReward
  storage.set<i32>('processingReward', _processingReward)

  logging.log('context timestamp' + Context.blockTimestamp.toString())
  //set summoning Time
  storage.set<u64>('summoningTime', Context.blockTimestamp)

  //set minimum share price
  storage.set<i32>('minSharePrice', _minSharePrice)

  //set initial Guild/Escrow/Total address balances

  userTokenBalances.push({user: GUILD, token: depositToken, balance: 0})
  userTokenBalances.push({user: ESCROW, token: depositToken, balance: 0})
  userTokenBalances.push({user: TOTAL, token: depositToken, balance: 0})

  // makes member object for summoner and puts it into the members storage
  members.set(Context.predecessor, new Member(Context.predecessor, 1, 0, true, 0, 0))

  memberAddressByDelegatekey.set(Context.predecessor, Context.predecessor)

  totalShares = 1

  //set init to done
  storage.set<string>("init", "done")

  summonCompleteEvent(Context.predecessor, _approvedTokens, Context.blockTimestamp, _periodDuration, _votingPeriodLength, _gracePeriodLength, _proposalDeposit, _dilutionBound, _processingReward)
  
  return true
}


/*********************/ 
/* UTILITY FUNCTIONS */
/*********************/

function _unsafeAddToBalance(account: AccountId, token: AccountId, amount: i32): void {
  logging.log('unsafe add account ' + account)
  logging.log('unsafe add token ' + token)
  logging.log('unsafe add amount ' + amount.toString())

  if(_userTokenBalanceExists(account, token)){
    let index = getUserTokenBalanceIndex(account, token)
    logging.log('unsafe add account/token index '+ index.toString())
  
    let record = userTokenBalances[index]
    logging.log('unsafe add record ' + record.user)
    logging.log('balance before add ' + record.balance.toString())
    record.balance += amount
    logging.log('balance after add ' + record.balance.toString())
    userTokenBalances[index] = record
  } else {
    userTokenBalances.push({user: account, token: token, balance: amount})
  }

  let totalIndex = getUserTokenBalanceIndex(TOTAL, token)
  let totalRecord = userTokenBalances[totalIndex]
  totalRecord.balance += amount
  userTokenBalances[totalIndex] = totalRecord
}

function _unsafeSubtractFromBalance(account: AccountId, token: AccountId, amount: i32): void {
  logging.log('unsafe subtract account ' + account)
  logging.log('unsafe subrract token ' + token)
  logging.log('unsafe subtract amount ' + amount.toString())

  if(_userTokenBalanceExists(account, token)){
    let index = getUserTokenBalanceIndex(account, token)
    logging.log('subtract index '+ index.toString())
    
    let record = userTokenBalances[index]
    logging.log('unsafe subtract record ' + record.user)

    logging.log('balance before subtract ' + record.balance.toString())
    record.balance -= amount
    logging.log('balance after subtract ' + record.balance.toString())
    userTokenBalances[index] = record
  
    let totalIndex = getUserTokenBalanceIndex(TOTAL, token)
    let totalRecord = userTokenBalances[totalIndex]
    totalRecord.balance -= amount
    userTokenBalances[totalIndex] = totalRecord
  }
}


function _unsafeInternalTransfer(from: AccountId, to: AccountId, token: AccountId, amount: i32): void {
  logging.log('from ' + from)
  logging.log('to ' + to)
  logging.log('token ' + token)
  logging.log('amount ' + amount.toString())
  _unsafeSubtractFromBalance(from, token, amount)
  _unsafeAddToBalance(to, token, amount)
}


function _fairShare(balance: i32, shares: i32, totalShares: i32): i32 {
  assert(totalShares != 0, ERR_GREATER_ZERO_TOTALSHARES)
  if(balance = 0) { return 0 }
  let prod = balance * shares
  if(prod / balance == shares) { return prod / totalShares }
  return (balance / totalShares) * shares
}


function hasVotingPeriodExpired(sP: i32): bool {
  let added = sP + storage.getSome<i32>('votingPeriodLength')
  return getCurrentPeriod() > added
}


function _vPP(proposalIndex: i32): Proposal {
  assert(proposalIndex < proposalQueue.length, ERR_PROPOSAL_NO)
 // let proposal = proposals[proposalQueue[proposalIndex]]
  let proposal = proposals[proposalIndex]
  let firstAdd = proposal.sP + storage.getSome<i32>('votingPeriodLength') 
  assert(getCurrentPeriod() >= firstAdd + storage.getSome<i32>('gracePeriodLength'), ERR_NOT_READY)
  assert(proposal.f[1] == false, ERR_PROPOSAL_PROCESSED)
  assert(proposalIndex == 0 || proposals[proposalQueue[proposalIndex - 1]].f[1], ERR_PREVIOUS_PROPOSAL)
  return proposal
}

function _didPass(proposal: Proposal): bool {

  let didPass = proposal.yV > proposal.nV

  // Make the proposal fail if the dilutionBound is exceeded 
  if((totalShares + totalLoot) * storage.getSome<i32>('dilutionBound') < proposal.mT) {
    didPass = false
  }

  // Make the proposal fail if the a is jailed
  // - for standard proposals, we don't want the a to get any shares/loot/payment
  // - for guild kick proposals, we should never be able to propose to kick a jailed member (or have two kick proposals active), so it doesn't matter
  
  if(members.get(proposal.a) != null) {
    if(members.getSome(proposal.a).jailed != 0) {
      didPass = false
    }
  }
  return didPass
}


function _returnDeposit(s: AccountId): void {
  let thisProposalDeposit = storage.getSome<i32>('proposalDeposit')
  let thisProcessingReward = storage.getSome<i32>('processingReward')
  let thisDepositToken = storage.getSome<string>('depositToken')
  _unsafeInternalTransfer(ESCROW, Context.predecessor, thisDepositToken, thisProcessingReward)

  let result = thisProposalDeposit - thisProcessingReward
  _unsafeInternalTransfer(ESCROW, s, thisDepositToken, result)
}

export function ragequit(sharesToBurn: i32, lootToBurn: i32): void {
  assert(onlyMember(Context.predecessor), ERR_NOT_A_MEMBER)
  _ragequit(Context.predecessor, sharesToBurn, lootToBurn)
}

function _ragequit(memberAddress: AccountId, sharesToBurn: i32, lootToBurn: i32): void {
  let initialTotalSharesAndLoot = totalShares + totalLoot

  let member = members.getSome(memberAddress)

  assert(member.shares >= sharesToBurn, ERR_INSUFFICIENT_SHARES)
  assert(member.loot >= lootToBurn, ERR_INSUFFICIENT_LOOT)

  assert(canRageQuit(member.highestIndexYesVote), ERR_CANNOT_RAGEQUIT)

  let sharesAndLootToBurn = sharesToBurn + lootToBurn

  // burn shares and loot
  member.shares = member.shares - sharesToBurn
  member.loot = member.loot - lootToBurn
  totalShares = totalShares - sharesToBurn
  totalLoot = totalLoot - lootToBurn

  let approvedTokensLength = approvedTokens.length
  let i = 0
  while (i < approvedTokensLength) {
    let amountToRagequit = _fairShare(getUserTokenBalance(GUILD, approvedTokens[i]), sharesAndLootToBurn, initialTotalSharesAndLoot)
    if (amountToRagequit > 0) { //gas optimization to allow a higher maximum token limit
      //deliberately not using safemath here to keep overflows from preventing the function execution (which would break ragekicks)
      //if a token overflows, it is because the supply was artificially inflated to oblivion, so we probably don't care about it anyways
      let current =  getUserTokenBalance(GUILD, approvedTokens[i])
      let modifiedDown = current - amountToRagequit
      let modifiedUp = current + amountToRagequit

      let newTokenBalance = new userTokenBalanceInfo()
      newTokenBalance.user = GUILD
      newTokenBalance.token = approvedTokens[<i32>i]
      newTokenBalance.balance = modifiedDown
      let downUserIndex = getUserTokenBalanceIndex(GUILD, approvedTokens[i])
      if(downUserIndex >= 0) {
        userTokenBalances.replace(downUserIndex, newTokenBalance)
      }

      let upTokenBalance = new userTokenBalanceInfo()
      upTokenBalance.user = memberAddress
      upTokenBalance.token = approvedTokens[i]
      upTokenBalance.balance = modifiedUp
      let upUserIndex = getUserTokenBalanceIndex(memberAddress, approvedTokens[<i32>i])
      if(upUserIndex >= 0) {
        userTokenBalances.replace(upUserIndex, newTokenBalance)
      }
    }
  }

  rageQuitEvent(Context.predecessor, sharesToBurn, lootToBurn)
}

function ragekick(memberToKick: AccountId): void {
 

  let member = members.getSome(memberToKick)

  assert(member.jailed != 0, ERR_IN_JAIL)
  assert(member.loot > 0, ERR_HAVE_LOOT) // note - should be impossible for jailed member to have shares
  assert(canRageQuit(member.highestIndexYesVote), ERR_CANNOT_RAGEQUIT)

  _ragequit(memberToKick, 0, member.loot)

 
}


function canRageQuit(highestIndexYesVote: i32): bool {
  assert(highestIndexYesVote > proposalQueue.length, ERR_PROPOSAL_NO)
  return proposals[proposalQueue[highestIndexYesVote]].f[1]
}


export function withdrawBalance(token: AccountId, amount: i32): void {
  _withdrawBalance(token, amount)  
}


export function withdrawBalances(tokens: Array<AccountId>, amounts: Array<i32>, all: bool = false): void {
  assert(tokens.length == amounts.length, ERR_MUST_MATCH)
  for(let i: u64 = 0, cpTokensLength: u64 = tokens.length; i < cpTokensLength; i++) {
    let withdrawAmount = amounts[<i32>i]
    if(all) { // withdraw maximum balance
      withdrawAmount = getUserTokenBalance(Context.predecessor, tokens[<i32>i])
    }
    _withdrawBalance(tokens[<i32>i], withdrawAmount)
  }
}

function _withdrawBalance(token: AccountId, amount: i32): void {
  assert(getUserTokenBalance(Context.predecessor, token) >= amount, ERR_INSUFFICIENT_BALANCE)
  _unsafeSubtractFromBalance(Context.predecessor, token, amount)
  let contract = MOLOCH_CONTRACT_ACCOUNT
  let ftAPI = new tokenAPI()
  ftAPI.transferFrom(contract, Context.predecessor, new u128(amount), token)
  
  withdrawlEvent(Context.predecessor, token, amount)
}

export function getTokenName(): void {
  if(approvedTokens.length > 0) {
  let ftAPI = new callAPI()
  ftAPI.callGetToken(approvedTokens[0])
  } else {
    logging.log('no approved tokens still')
  }
}

function getUsedGas(): void {
  usedGas += env.used_gas() 
  logging.log('cumulative gas used ' + usedGas.toString())
}

function getUsedStorage(): void {
  usedStorage += env.storage_usage() 
  logging.log('cumulative storage used ' + usedStorage.toString())
}

export function getInitSettings(): Array<Array<string>> {
  let settings = new Array<Array<string>>()
  //get Summoner
  let summoner = storage.getSome<string>("summoner")

  //get periodDuration
  let periodDuration = storage.getSome<i32>('periodDuration')

  //set votingPeriodLength
  let votingPeriodLength = storage.getSome<i32>('votingPeriodLength')

  //set gracePeriodLength
  let gracePeriodLength = storage.getSome<i32>('gracePeriodLength')

  //set proposalDeposit
  let proposalDeposit = storage.getSome<i32>('proposalDeposit')

  //set dilutionBound
  let dilutionBound = storage.getSome<i32>('dilutionBound')

  //set processingReward
  let processingReward = storage.getSome<i32>('processingReward')

  //set summoning Time
  let summoningTime = storage.getSome<u64>('summoningTime')

  //set minimum share price
  let minSharePrice = storage.getSome<i32>('minSharePrice')
 
  settings.push([
    summoner, 
    periodDuration.toString(), 
   votingPeriodLength.toString(),
   gracePeriodLength.toString(),
   proposalDeposit.toString(),
   dilutionBound.toString(),
   processingReward.toString(),
   summoningTime.toString(),
   minSharePrice.toString(),
   depositToken.toString()
  ])

  return settings
}


// export function collectTokens(token: AccountId): void {

//   assert(onlyDelegate(Context.predecessor), ERR_NOT_DELEGATE)

//   let ftAPI = new tokenAPI()
//   ftAPI.callBalanceOf(token, Context.predecessor)
  
//   let amountToCollect = u128.sub(balance, getUserTokenBalance(TOTAL, token))
  
//   only collect if 1) there are tokens to collect 2) token is whitelisted 3) token has non-zero balance
//   assert(amountToCollect > u128.Zero, ERR_NO_TOKENS)
//   assert(tokenWhiteList.getSome(token), ERR_TOKEN_NOT_WHITELISTED)
//   assert(getUserTokenBalance(GUILD, token) > u128.Zero, ERR_NONZERO_BANK)

//   _unsafeAddToBalance(GUILD, token, amountToCollect)
//   tokensCollectedEvent(token, amountToCollect)


// }


// NOTE: requires that delegate key which sent the original proposal cancels, Context.predecessor == proposal.owner
export function cancelProposal(pI: i32): void {
 
  let proposal = proposals[pI]
  
  assert(!proposal.f[0], ERR_ALREADY_SPONSORED)
  assert(!proposal.f[3], ERR_ALREADY_CANCELLED)
  assert(Context.predecessor == proposal.p, ERR_ONLY_PROPOSER)

  let f = proposal.f // [sed, processed, didPass, cancelled, whitelist, guildkick]
  f[3] = true; //cancelled
 
  proposal.f = f
  //proposals.replace(pI, proposal)  
  proposals[pI] = proposal

  let index = getProposalEventsIndex(pI)
  let proposalEvent = submitProposalEvents[index]
  proposalEvent.f = f
  submitProposalEvents[index] = proposalEvent

  _unsafeInternalTransfer(ESCROW, proposal.p, proposal.tT, proposal.tO)
  cancelProposalEvent(pI, Context.predecessor)
}


export function updateDelegateKey(newDelegateKey: AccountId): void {


  assert(onlyShareholder(Context.predecessor), ERR_NOT_SHAREHOLDER)
  assert(env.isValidAccountID(newDelegateKey), ERR_INVALID_ACCOUNT_ID)

  // skip checks if member is setting the delegate key to their member address
  if(newDelegateKey != Context.predecessor) {
    assert(!members.getSome(newDelegateKey).existing, ERR_NO_OVERWRITE_MEMBER)
    assert(!members.getSome(memberAddressByDelegatekey.getSome(newDelegateKey)).existing, ERR_NO_OVERWRITE_KEY)
  }

  let member = members.getSome(Context.predecessor)
  memberAddressByDelegatekey.set(member.delegateKey, '')
  memberAddressByDelegatekey.set(newDelegateKey, Context.predecessor)
  member.delegateKey = newDelegateKey

  updateDelegateKeyEvent(Context.predecessor, newDelegateKey)


}

/********************************/ 
/* GETTER FUNCTIONS             */
/********************************/

/**
 * returns DAO init status
 */
export function getInit(): string {
  return storage.getSome<string>("init")
}

/**
 * returns current token owner
 */
export function getSummoner(): string {
  return storage.getSome<string>("summoner")
}

/**
 * returns deposit token type
 */
export function getDepositToken(): string {
  return storage.getSome<string>("depositToken")
}

export function getProposalDeposit(): i32 {
  return storage.getSome<i32>("proposalDeposit")
}

export function getPeriodDuration(): i32 {
  return storage.getSome<i32>("periodDuration")
}

export function getProcessingReward(): i32 {
  return storage.getSome<i32>("processingReward")
}

export function getMemberStatus(member: AccountId): bool {
  if(members.get(member)){
    return true
  }
  return false
}

export function getMemberShares(member: AccountId): i32 {
  if(members.get(member) != null) {
    let shares = members.getSome(member).shares
    return shares
  }
  return 0
}

export function getMemberLoot(member: AccountId): i32 {
  if(members.get(member) != null) {
    let loot = members.getSome(member).loot
    return loot
  }
  return 0
}

export function getMemberInfo(member: AccountId): Array<Member> {
  let thisMember = new Array<Member>()
  let aMember = members.get(member, new Member('', 0, 0, false, 0, 0))!
  thisMember.push(aMember)
  return thisMember
}

export function getCurrentPeriod(): i32 {
  let summonTime = storage.getSome<u64>('summoningTime') // blocktimestamp that dao was summoned
  let pd:u64 = <u64>storage.getSome<i32>('periodDuration') * 1000000000 // duration converted to nanoseconds for each period
  if(pd != 0) {
    let interim = Context.blockTimestamp - summonTime
    let result = interim / pd
    return <i32>result
  }
  return 0
}

export function getProposalEventsIndex(pI: i32): i32 {
  let submitProposalEventsLength = submitProposalEvents.length
  let i = 0
  while (i < submitProposalEventsLength) {
    if (submitProposalEvents[i].pI == pI) {
      return i
    }
    i++
  }
  return -1
}



export function getProposalQueueLength(): i32 {
  return proposalQueue.length
}

export function getProposalFlags(pI: i32): bool[] {
  return proposals[pI].f
}

export function getUserTokenBalance(user: AccountId, token: AccountId): i32 {
  let userTokenBalanceLength = userTokenBalances.length
  let i = 0
  while (i < userTokenBalanceLength ) {
    if(userTokenBalances[<i32>i].user == user && userTokenBalances[<i32>i].token == token) {
      return userTokenBalances[<i32>i].balance
    }
    i++
  }
  return 0
}

export function getUserTokenBalanceObject(): PersistentVector<userTokenBalanceInfo> {
  return userTokenBalances
}

export function getGuildTokenBalances(): Array<TokenBalances> {
  let balances = new Array<TokenBalances>()
  let approvedTokensLength = approvedTokens.length
  let i = 0
  while (i < approvedTokensLength) {
    let balance = getUserTokenBalance(GUILD, approvedTokens[i])
    logging.log('guild balance ' + balance.toString())
    balances.push({token: approvedTokens[i], balance: balance})
    i++
  }
  return balances
}

export function getEscrowTokenBalances(): Array<TokenBalances> {
  let balances = new Array<TokenBalances>()
  let approvedTokensLength = approvedTokens.length
  let i = 0
  while (i < approvedTokensLength) {
    let balance = getUserTokenBalance(ESCROW, approvedTokens[i])
    balances.push({token: approvedTokens[i], balance: balance})
    i++
  }
  return balances
}

export function getMemberProposalVote(memberAddress: AccountId, pI: i32): string {
  let votesByMemberLength = votesByMember.length
  let i = 0
  while( i < votesByMemberLength ){
    if(votesByMember[i].user == memberAddress && votesByMember[i].pI == pI){
      return votesByMember[i].vote
    }
    i++
  }
  return 'no vote yet'
}

export function getProposalVotes(pI: i32): Array<Votes> {
  let yV = proposals[pI].yV
  let nV = proposals[pI].nV
  let voteArray = new Array<Votes>()
  voteArray.push({yes: yV, no: nV})
  return voteArray
}

export function getTokenCount(): i32 {
  return approvedTokens.length
}

export function getProposalIndex(pI: i32): i32 {
  let proposalsLength = proposals.length
  logging.log('proposals length ' + proposalsLength.toString())
  logging.log(' pi here ' + pI.toString())
  let i = 0
    while (i < proposalsLength) {
      if (proposals[i].pI == pI) {
        logging.log('i ' + i.toString())
        return i
      }
      i++
    }
  return -1
}

function _userTokenBalanceExists(user: AccountId, token: AccountId): bool {
  let userTokenBalancesLength = userTokenBalances.length
  let i = 0
    while (i < userTokenBalancesLength) {
      if (userTokenBalances[i].user == user && userTokenBalances[i].token == token) {
        return true
      }
      i++
  }
  return false
}


export function getUserTokenBalanceIndex(user: AccountId, token: AccountId): i32 {
  let userTokenBalancesLength = userTokenBalances.length
  let i = 0
  if (userTokenBalancesLength != 0) {
    while (i < userTokenBalancesLength) {
      if (userTokenBalances[i].user == user && userTokenBalances[i].token == token) {
        return i
      }
      i++
    }
  }
  return 0
}

function _memberProposalPresent(applicant: AccountId): bool {
  let proposalsLength = proposals.length
  let i = 0
  while (i < proposalsLength) {
    if (proposals[i].a == applicant && proposals[i].f[6] == true && (proposals[i].f[2] == true && proposals[i].f[1] == true)) {
      return true
    }
    i++
  }
  return false
}

function _max(x: i32, y: i32): i32 {
  return x >= y ? x : y
}

/**
 * returns all Proposal Events
 */
export function getAllProposalEvents(): Array<SPE> {
  let _frList = new Array<SPE>();
  let submitProposalEventsLength = submitProposalEvents.length;
  if(submitProposalEventsLength != 0) {
    let i = 0
    while (i < submitProposalEventsLength) {
      _frList.push(submitProposalEvents[i])
      i++
    }
  }
  return _frList;
}

/*****************
PROPOSAL FUNCTIONS
*****************/

export function submitProposal (
    a: AccountId, // a
    sR: i32, //sR
    lR: i32, //lR
    tO: i32, //tO
    tT: AccountId, //tT
    pR: i32, //pR
    pT: AccountId //pT
): bool {
  
  assert((sR + lR) <= MAX_NUMBER_OF_SHARES_AND_LOOT, ERR_TOO_MANY_SHARES)
  assert(tokenWhiteList.getSome(tT), ERR_NOT_WHITELISTED)
  assert(tokenWhiteList.getSome(pT), ERR_NOT_WHITELISTED_PT)
  assert(env.isValidAccountID(a), ERR_INVALID_ACCOUNT_ID)
  assert(a != GUILD && a != ESCROW && a != TOTAL, ERR_RESERVED)

  if(members.get(a)!=null) {
    assert(members.getSome(a).jailed == 0, ERR_JAILED)
  }
  
  if(tO > 0 && getUserTokenBalance(GUILD, tT) == 0) {
    assert(totalGuildBankTokens < MAX_TOKEN_GUILDBANK_COUNT, ERR_FULL_GUILD_BANK)
  }

  _sT(tO, tT)  

  _unsafeAddToBalance(ESCROW, tT, tO)

  let f = new Array<bool>(7) // [sponsored, processed, didPass, cancelled, whitelist, guildkick, member]
  if(sR > 0){
    f[6] = true // member proposal
  }
 
  _submitProposal(a, sR, lR, tO, tT, pR, pT, f)
  getUsedGas()
  getUsedStorage()
  return true
}

function _sT(tO: i32, tT: AccountId): void {
  // collect tribute from p and store it in the Moloch until the proposal is processed
  
  // near transfers
  if(tT == 'NEAR') {
    logging.log('starting NEAR transfer')
    let promise = ContractPromiseBatch.create(MOLOCH_CONTRACT_ACCOUNT)
      .transfer(u128.from(tO))
    logging.log('finished NEAR transfer')
  } else {
    // other token transfers
    let ftAPI = new tokenAPI()
    ftAPI.incAllowance(new u128(tO), tT)
    ftAPI.transferFrom(Context.sender, MOLOCH_CONTRACT_ACCOUNT, new u128(tO), tT)
  }
}


export function submitWhitelistProposal(tokenToWhitelist: string): bool {
  assert(env.isValidAccountID(tokenToWhitelist), ERR_INVALID_ACCOUNT_ID)
  assert(!tokenWhiteList.getSome(tokenToWhitelist), ERR_ALREADY_WHITELISTED)
  assert(approvedTokens.length < MAX_TOKEN_WHITELIST_COUNT, ERR_TOO_MANY_WHITELISTED)

  let f = new Array<bool>(7) // [sponsored, processed, didPass, cancelled, whitelist, guildkick]
  f[4] = true; // whitelist
  _submitProposal('', 0, 0, 0, tokenToWhitelist, 0, '', f)
  return true
}


export function submitGuildKickProposal(memberToKick: AccountId): bool {
  let member = members.getSome(memberToKick)
  assert(member.shares > 0 || member.loot > 0, ERR_SHAREORLOOT)
  assert(member.jailed == 0, ERR_JAILED)

  let f = new Array<bool>(7) // [sponsored, processed, didPass, cancelled, whitelist, guildkick]
  f[5] = true; // guild kick
  
  _submitProposal(memberToKick, 0, 0, 0, '', 0, '', f)
  return true
}


function _submitProposal(
  a: AccountId,
  sR: i32,
  lR: i32,
  tO: i32,
  tT: AccountId,
  pR: i32,
  pT: AccountId,
  f: Array<bool>
): void {
  let pI = proposals.length
  logging.log('proposals length'+ pI.toString())

  if (f[6]){
    assert(members.get(a)==null, 'already a member')
    assert(_memberProposalPresent(a) == false, 'member proposal already in progress')
  }

  proposals.push(new Proposal(
    pI,
    a,
    Context.sender,
    '',
    sR,
    lR,
    tO,
    tT,
    pR,
    pT,
    0,
    0,
    0,
    f,
    0,
    Context.blockTimestamp,
    0,
    0
  ))
  
  votesByMember.push({user: Context.predecessor, pI: pI, vote: ''})
  let mA: AccountId
  if(memberAddressByDelegatekey.get(Context.sender)!=null) {
    mA = memberAddressByDelegatekey.getSome(Context.sender)
  } else {
    mA = Context.sender
  }

  sPE(pI, a, sR, lR, tO, tT, pR, pT, f, Context.predecessor, mA, Context.blockTimestamp, 0, 0, 0, 0, 0)
}


export function sponsorProposal(pI: i32, proposalDeposit: i32, depositToken: AccountId): void {
 
  assert(onlyDelegate(Context.predecessor), 'not a delegate')
  // collect proposal deposit from s and store it in the Moloch until the proposal is processed

  _sT(proposalDeposit, depositToken)

  _unsafeAddToBalance(ESCROW, depositToken, proposalDeposit)
  
  let proposalIndex = getProposalIndex(pI)
  let proposal = proposals[proposalIndex]

  assert(proposal.pI == pI, 'not right proposal')
  assert(env.isValidAccountID(proposal.p), 'invalid account ID and not proposed')
  assert(!proposal.f[0], 'already sponsored')
  assert(!proposal.f[3], 'proposal cancelled')
 
  if(members.get(proposal.a)!=null){
    assert(members.getSome(proposal.a).jailed == 0, 'member jailed')
  }

  if(proposal.tO > 0 && getUserTokenBalance(GUILD, proposal.tT) == 0 ) {
    assert(totalGuildBankTokens < MAX_TOKEN_GUILDBANK_COUNT, 'guild bank full')
  }
  
  // Whitelist proposal
  if(proposal.f[4]) {
    assert(!tokenWhiteList.getSome(proposal.tT), 'already whitelisted')
    assert(!proposedToWhiteList.getSome(proposal.tT), 'whitelist proposed already')
    assert(approvedTokens.length < MAX_TOKEN_WHITELIST_COUNT, 'can not s more')
    proposedToWhiteList.set(proposal.tT, true)

    //Guild Kick Proposal
  } else if (proposal.f[5]) {
    assert(!proposedToKick.getSome(proposal.a), 'proposed to kick')
    proposedToKick.set(proposal.a, true)
  }

  // compute starting period for proposal
  let max = _max(
    getCurrentPeriod(), 
    proposalQueue.length == 0 ? 0 : proposals[proposalQueue[proposalQueue.length - 1]].sP
  )
  let sP = max + 1
  
  let vP = sP + storage.getSome<i32>('votingPeriodLength')
  let gP = sP + storage.getSome<i32>('votingPeriodLength') + storage.getSome<i32>('gracePeriodLength')
  
  logging.log('proposal queue length '+ proposalQueue.length.toString())
  
  if(proposalQueue.length > 0){
  logging.log('last proposal sP '+ proposals[proposalQueue[proposalQueue.length - 1]].sP.toString() )
  }
  logging.log('max ' + max.toString())
  logging.log('this starting period' + sP.toString())

  let memberAddress = memberAddressByDelegatekey.getSome(Context.predecessor)

  let f = proposal.f // [sponsored, processed, didPass, cancelled, whitelist, guildkick, member]
  f[0] = true; //sponsored

  proposal.f = f
  proposal.sP = sP
  proposal.s = memberAddress
  proposal.vP = vP
  proposal.gP = gP
  
  //proposals.replace(pI, proposal)  
  proposals[proposalIndex] = proposal
  logging.log('sponsor proposal flags ' + proposal.f.toString())

  let index = getProposalEventsIndex(pI)
  let proposalEvent = submitProposalEvents[index]
  proposalEvent.f = f
  proposalEvent.vP = vP
  proposalEvent.gP = gP
  proposalEvent.sP = sP
  submitProposalEvents[index] = proposalEvent

  // append proposal to queue
  proposalQueue.push(pI)
  
  sponsorProposalEvent(Context.predecessor, memberAddress, pI, sP)

  getUsedGas()
  getUsedStorage()
}


export function submitVote(pI: i32, vote: string): void {

  assert(onlyDelegate(Context.predecessor), ERR_NOT_DELEGATE)
  let memberAddress = memberAddressByDelegatekey.getSome(Context.predecessor)
  let member = members.getSome(memberAddress)

  assert(pI < proposalQueue.length, ERR_PROPOSAL_NO)
  let proposalIndex = getProposalIndex(pI)
  let proposal = proposals[proposalIndex]
  logging.log('proposalIndex ' + proposalIndex.toString())
  logging.log('proposal pI ' + proposal.pI.toString())
  logging.log('proposal sp' + proposal.sP.toString())
  logging.log('current period ' + getCurrentPeriod().toString())
  logging.log('proposal vP ' + proposal.vP.toString())
  assert(vote == 'abstain' || vote == 'yes' || vote=='no', ERR_VOTE_INVALID)
  assert(getCurrentPeriod() >= proposal.sP, ERR_VOTING_NOT_STARTED)
  assert(getCurrentPeriod() <= proposal.vP, ERR_VOTING_PERIOD_EXPIRED)
  //assert(!hasVotingPeriodExpired(proposal.sP), ERR_VOTING_PERIOD_EXPIRED)
  
  let existingVote = getMemberProposalVote(Context.predecessor, pI)

  assert(existingVote == 'no vote yet', ERR_ALREADY_VOTED)

  votesByMember.push({user: Context.predecessor, pI: pI, vote: vote})

  if(vote == 'yes') {
    let newyV = proposal.yV + member.shares

    //set highest index (latest) yes vote - must be processed for member to ragequit
    if(proposalIndex > member.highestIndexYesVote) {
      member.highestIndexYesVote = proposalIndex
      members.set(memberAddress, new Member(
        member.delegateKey,
        member.shares, 
        member.loot, 
        true,
        member.highestIndexYesVote,
        member.jailed
        ))
    }

    // set maximum of total shares encountered at a yes vote - used to bound dilution for yes voters
    let newmT: i32
    if((totalShares + totalLoot) > proposal.mT) {
      newmT = totalShares + totalLoot
    } else {
      newmT = proposal.mT
    }
    proposal.yV = newyV
    proposal.mT = newmT
  //  proposals.replace(pI, proposal)
    proposals[proposalIndex] = proposal

    let index = getProposalEventsIndex(pI)
    let proposalEvent = submitProposalEvents[index]
    proposalEvent.yV = newyV
    submitProposalEvents[index] = proposalEvent

  } else if (vote == 'no') {
    let newnV = proposal.nV + member.shares

    proposal.nV = newnV

    //   proposals.replace(pI, proposal)
    proposals[proposalIndex] = proposal 

    let index = getProposalEventsIndex(pI)
    let proposalEvent = submitProposalEvents[index]
    proposalEvent.nV = newnV
    submitProposalEvents[index] = proposalEvent
  }

  // NOTE: subgraph indexes by proposalId not proposalIndex since proposalIndex isn't set until it's been sed but proposal is created on submission
  submitVoteEvent(proposalQueue[pI], Context.predecessor, memberAddress, vote)
 
  getUsedGas()
  getUsedStorage()
}


export function processProposal(pI: i32): bool {

  let proposalIndex = getProposalIndex(pI)
  let proposal = _vPP(proposalIndex)
  
  assert(!proposal.f[4] && !proposal.f[5], ERR_STANDARD_PROPOSAL)

  let f = proposal.f // [sponsored, processed, didPass, cancelled, whitelist, guildkick, member]
  f[1] = true; //processed

  proposal.f = f
  proposals[proposalIndex] = proposal

  let index = getProposalEventsIndex(pI)
  let proposalEvent = submitProposalEvents[index]
  proposalEvent.f = f
  submitProposalEvents[index] = proposalEvent

  let didPass = _didPass(proposal)

  //Make the proposal fail if the new total number of shares and loot exceeds the limit
  let firstAdd = totalShares + totalLoot
  let secondAdd = proposal.sR + proposal.lR
  if((firstAdd + secondAdd) > MAX_NUMBER_OF_SHARES_AND_LOOT) {
    didPass = false
  }

  //Make the proposal fail if it is requesting more tokens as payment than the available guild bank balance
  if(proposal.pR > getUserTokenBalance(GUILD, proposal.pT)) {
    didPass = false
  }

  //Make the proposal fail if it would result in too many tokens with non-zero balance in guild bank
  if(proposal.tO > 0 && getUserTokenBalance(GUILD, proposal.tT) == 0 && totalGuildBankTokens >= MAX_TOKEN_GUILDBANK_COUNT) {
    didPass = false
  }
  if(didPass){
    proposalPassed(proposalIndex, proposal)
  } else {
    proposalFailed(proposalIndex, proposal)
  }

 
  _returnDeposit(proposal.s)

  return didPass
}

  export function proposalPassed(proposalIndex: i32, proposal: Proposal): void {
    logging.log('proposal passed')
  
    let f = proposal.f // [sponsored, processed, didPass, cancelled, whitelist, guildkick]
    f[2] = true; //didPass
    proposal.f = f
    
    proposals[proposalIndex] = proposal

    let index = getProposalEventsIndex(proposal.pI)
    let proposalEvent = submitProposalEvents[index]
    proposalEvent.f = f
    submitProposalEvents[index] = proposalEvent

    if(members.get(proposal.a)!=null) {
      // if the a is already a member, add to their existing shares and loot
      let member = members.getSome(proposal.a)
      let newShares = member.shares + proposal.sR
      let newLoot = member.loot + proposal.lR
  
      members.set(proposal.a, new Member(
        member.delegateKey,
        newShares, 
        newLoot, 
        true,
        member.highestIndexYesVote,
        member.jailed
        ))

      // the a is a new member, create a new record for them 
      } else {
        // if the a address is already taken by a member's delegateKey, reset it to their member address
        if(memberAddressByDelegatekey.get(proposal.a)!=null){
          if(members.get(memberAddressByDelegatekey.getSome(proposal.a))!=null) {
            let memberToOverride = memberAddressByDelegatekey.getSome(proposal.a)
            memberAddressByDelegatekey.set(memberToOverride, memberToOverride)
        
            let member = members.getSome(memberToOverride)
      
            members.set(memberToOverride, new Member(
              memberToOverride,
              member.shares, 
              member.loot, 
              true,
              member.highestIndexYesVote,
              member.jailed
              ))
          }
        }
        // use a address as delegateKey by default
        members.set(proposal.a, new Member(proposal.a, proposal.sR, proposal.lR, true, 0, 0))
        memberAddressByDelegatekey.set(proposal.a, proposal.a)
      }

    // mint new shares and loot
    totalShares = totalShares + proposal.sR
    totalLoot = totalLoot + proposal.lR

    // if the proposal tribute is the first tokens of its kind to make it into the guild bank, increment total guild bank tokens
    if(getUserTokenBalance(GUILD, proposal.tT) == 0 && proposal.tO > 0) {
      totalGuildBankTokens = totalGuildBankTokens + 1
    }

    //move tribute from escrow to bank
    _unsafeInternalTransfer(ESCROW, GUILD, proposal.tT, proposal.tO)

    //give applicant the funds requested from the guild bank
    _unsafeInternalTransfer(GUILD, proposal.a, proposal.pT, proposal.pR)

    // if the proposal spends 100% of guild bank balance for a token, decrement total guild bank tokens
    if(getUserTokenBalance(GUILD, proposal.pT) == 0 && proposal.pR > 0) {
      totalGuildBankTokens = totalGuildBankTokens -1
    }
    processProposalEvent(proposalIndex, true)
  }

export function proposalFailed(proposalIndex: i32, proposal: Proposal): void {
  logging.log('proposal failed')
  //return all tokens to the proposer (not the applicant, because funds come from the proposer)
  _unsafeInternalTransfer(ESCROW, proposal.p, proposal.tT, proposal.tO)

  processProposalEvent(proposalIndex, false)
}


export function processWhitelistProposal(pI: i32): void {

  let proposalIndex = getProposalIndex(pI)
  let proposal = _vPP(proposalIndex)

  assert(proposal.f[4], ERR_WHITELIST_PROPOSAL)

  let f = proposal.f // [sed, processed, didPass, cancelled, whitelist, guildkick]
  f[1] = true; //processed
  proposal.f = f
  //proposals.replace(proposalId,proposal)
  proposals[proposalIndex] = proposal

  let index = getProposalEventsIndex(pI)
  let proposalEvent = submitProposalEvents[index]
  proposalEvent.f = f
  submitProposalEvents[index] = proposalEvent

  let didPass = _didPass(proposal)

  if(approvedTokens.length >= MAX_TOKEN_WHITELIST_COUNT) {
    didPass = false
  }

  if (didPass) {
    let f = proposal.f // [sed, processed, didPass, cancelled, whitelist, guildkick]
    f[2] = true; //didPass
    proposal.f = f
    //proposals.replace(proposalId, proposal)
    proposals[proposalIndex] = proposal

    let index = getProposalEventsIndex(pI)
    let proposalEvent = submitProposalEvents[index]
    proposalEvent.f = f
    submitProposalEvents[index] = proposalEvent

    tokenWhiteList.set(proposal.tT, true)
    approvedTokens.push(proposal.tT)
  }

  proposedToWhiteList.set(proposal.tT, false)

  let thisProposalDeposit = storage.getSome<i32>('proposalDeposit')
  logging.log('this proposal deposit ' + thisProposalDeposit.toString())
  let thisProcessingReward = storage.getSome<i32>('processingReward')
  logging.log('this Processing Reward ' + thisProcessingReward.toString())

  _returnDeposit(proposal.s)

  processWhiteListProposalEvent(pI, proposalIndex, didPass)
  
}


export function processGuildKickProposal(pI: i32): void {

  let proposalIndex = getProposalIndex(pI)
  let proposal = _vPP(proposalIndex)

  assert(proposal.f[5], ERR_GUILD_PROPOSAL)

  let f = proposal.f // [sed, processed, didPass, cancelled, whitelist, guildkick]
  f[1] = true; //processed
  
  proposal.f = f
  //proposals.replace(proposalId, proposal)
  proposals[proposalIndex] = proposal

  let index = getProposalEventsIndex(pI)
  let proposalEvent = submitProposalEvents[index]
  proposalEvent.f = f
  submitProposalEvents[index] = proposalEvent

  let didPass = _didPass(proposal)

  if(didPass) {
    logging.log('proposal passed')
    let f = proposal.f // [sed, processed, didPass, cancelled, whitelist, guildkick]
    f[2] = true; //didPass

    proposal.f = f
    proposals[proposalIndex] = proposal

    let index = getProposalEventsIndex(pI)
    let proposalEvent = submitProposalEvents[index]
    proposalEvent.f = f
    submitProposalEvents[index] = proposalEvent

    let member = members.getSome(proposal.a)

    let updateMember = new Member(
      member.delegateKey,
      0, // revoke all shares
      member.loot + member.shares, //transfer shares to loot
      true,
      member.highestIndexYesVote,
      proposalIndex
      )

    members.set(proposal.a, updateMember)
     
    //transfer shares to loot
  
    totalShares = totalShares - member.shares
    totalLoot = totalLoot + member.shares

  }

  proposedToKick.set(proposal.a, false)

  

  _returnDeposit(proposal.s)

  processGuildKickProposalEvent(pI, didPass)

}

/********************************/ 
/* CROSS CONTRACT API FUNCTIONS */
/********************************/



export class tokenAPI {

  // Cross Contract Calls Working

  transferFrom(from: AccountId, to: AccountId, amount: u128, tT: AccountId): void { //tT is the fungible token contract account for the tT
    let args: TransferFromArgs = { owner_id: from, new_owner_id: to, amount: amount }

    let promise = ContractPromise.create(
      tT, 
      "transfer_from", 
      args.encode(), 
      30000000000000, 
      u128.Zero
    )

    assert(promise, ERR_TRIBUTE_TRANSFER_FAILED)

    promise.returnAsResult()
  }

  incAllowance(amount: u128, tokenContract: AccountId): void {
    let args: IncAllowanceArgs = { escrow_account_id: MOLOCH_CONTRACT_ACCOUNT, amount: amount }
    let promise = ContractPromise.create(
      tokenContract,
      "inc_allowance",
      args.encode(),
      22500000000000,
      u128.Zero
    )
    promise.returnAsResult()
  }

}

export class callAPI {
  callGetToken(token: AccountId): void {

    let promise = ContractPromise.create(
      token,
      "getTokenName",
      new Uint8Array(0),
      100,
      u128.Zero)

    promise.returnAsResult()
  }

  callBalanceOf(token: AccountId, account: AccountId): void {
    let args: BalanceArgs = {account}

    let promise = ContractPromise.create(
      token, // contract account Id
      "get_balance", // method
      args.encode(), // serialized contract method arguments as Uint8Array
      100, // gas attached to call
      u128.Zero) // attached deposit to be sent with call

      promise.returnAsResult()
  }
}

  
  
  
  
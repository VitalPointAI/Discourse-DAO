  

import { Context, storage, logging, env, u128, ContractPromise, PersistentVector } from "near-sdk-as"
import { 
  AccountId, 
  periodDuration, 
  votingPeriodLength, 
  gracePeriodLength, 
  proposalDeposit, 
  dilutionBound, 
  processingReward,
  minSharePrice
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
  TokenBalances
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


// HARD-CODED LIMITS
// These numbers are quite arbitrary; they are small enough to avoid overflows when doing calculations
// with periods or shares, yet big enough to not limit reasonable use cases.
const MAX_VOTING_PERIOD_LENGTH: i32 = 10**8 // maximum length of voting period
const MAX_GRACE_PERIOD_LENGTH:i32 = 10**8 // maximum length of grace period
const MAX_DILUTION_BOUND: i32 = 10**8 // maximum dilution bound
const MAX_NUMBER_OF_SHARES_AND_LOOT: i32 = 10**8 // maximum number of shares that can be minted
const MAX_TOKEN_WHITELIST_COUNT: i32 = 400 // maximum number of whitelisted tokens
const MAX_TOKEN_GUILDBANK_COUNT: i32 = 200 // maximum number of tokens with non-zero balance in guildbank
const MOLOCH_CONTRACT_ACCOUNT: AccountId = 'dao1.vitalpointai.testnet'; // DAO accountId

// *******************
// INTERNAL ACCOUNTING
// *******************

let totalShares: i32 = 0 // total shares across all members
let totalLoot: i32 = 0 // total loot across all members
let usedGas: u64 //accumulating gas
let usedStorage: u64 //accumulating storage

let totalGuildBankTokens: i32 // total tokens with non-zero balance in guild bank

let depositToken: AccountId

const GUILD: AccountId = 'guild.vitalpointai.testnet'
const ESCROW: AccountId = 'escrow.vitalpointai.testnet'
const TOTAL: AccountId = 'total.vitalpointai.testnet'

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
    periodDuration: periodDuration,
    votingPeriodLength: votingPeriodLength,
    gracePeriodLength: gracePeriodLength,
    proposalDeposit: proposalDeposit,
    dilutionBound: dilutionBound,
    processingReward: processingReward,
    minSharePrice: minSharePrice
): boolean {
  assert(storage.get<string>("init") == null, ERR_DAO_ALREADY_INITIALIZED)
  assert(periodDuration > 0, ERR_MUSTBE_GREATERTHAN_ZERO)
  assert(votingPeriodLength > 0, ERR_MUSTBE_GREATERTHAN_ZERO)
  assert(votingPeriodLength <= MAX_VOTING_PERIOD_LENGTH, ERR_MUSTBELESSTHAN_MAX_VOTING_PERIOD_LENGTH)
  assert(gracePeriodLength <= MAX_GRACE_PERIOD_LENGTH, ERR_MUSTBELESSTHAN_MAX_GRACE_PERIOD_LENGTH)
  assert(dilutionBound > 0, ERR_DILUTIONBOUND_ZERO)
  assert(dilutionBound <= MAX_DILUTION_BOUND, ERR_DILUTIONBOUND_LIMIT)
  assert(_approvedTokens.length > 0, ERR_APPROVEDTOKENS)
  assert(_approvedTokens.length <= MAX_TOKEN_WHITELIST_COUNT, ERR_TOO_MANY_TOKENS)
  assert(proposalDeposit >= processingReward, ERR_PROPOSAL_DEPOSIT)
  assert(minSharePrice > 0, ERR_MUSTBE_GREATERTHAN_ZERO)

  depositToken = _approvedTokens[0]

  storage.set<string>('depositToken', depositToken)

  for (let i: u64 = 0; i < <u64>_approvedTokens.length; i++) {
    assert(env.isValidAccountID(_approvedTokens[<i32>i]), ERR_INVALID_ACCOUNT_ID)
    if(tokenWhiteList.contains(_approvedTokens[<i32>i])) {
      assert(!tokenWhiteList.getSome(_approvedTokens[<i32>i]), ERR_DUPLICATE_TOKEN)
    } else {
      tokenWhiteList.set(_approvedTokens[<i32>i], true)
    }
    approvedTokens.push(_approvedTokens[<i32>i])
  }
  
  //set Summoner
  storage.set<string>('summoner', Context.predecessor)

  //set periodDuration
  storage.set<i32>("periodDuration", periodDuration)

  //set votingPeriodLength
  storage.set<i32>('votingPeriodLength', votingPeriodLength)

  //set gracePeriodLength
  storage.set<i32>('gracePeriodLength', gracePeriodLength)

  //set proposalDeposit
  storage.set<i32>('proposalDeposit', proposalDeposit)

  //set dilutionBound
  storage.set<i32>('dilutionBound', dilutionBound)

  //set processingReward
  storage.set<i32>('processingReward', processingReward)

  //set summoning Time
  storage.set<u64>('summoningTime', Context.blockIndex)

  //set minimum share price
  storage.set<i32>('minSharePrice', minSharePrice)

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

  summonCompleteEvent(Context.predecessor, _approvedTokens, Context.blockIndex, periodDuration, votingPeriodLength, gracePeriodLength, proposalDeposit, dilutionBound, processingReward)
  
  return true
}


/*********************/ 
/* UTILITY FUNCTIONS */
/*********************/

function _unsafeAddToBalance(account: AccountId, token: AccountId, amount: i32): void {
  for(let i: u64 = 0; i < <u64>userTokenBalances.length; i++) {
    if(userTokenBalances[<i32>i].user == account && userTokenBalances[<i32>i].token == token) {
      let userCurrent = userTokenBalances[<i32>i].balance
      let newUserAmount = userCurrent + amount
      userTokenBalances.replace(<i32>i, {user: account, token: token, balance: newUserAmount})
    } else if(userTokenBalances[<i32>i].user == TOTAL && userTokenBalances[<i32>i].token == token) {
      let totalCurrent = userTokenBalances[<i32>i].balance
      let newTotalAmount = totalCurrent + amount
      userTokenBalances.replace(<i32>i, {user: TOTAL, token: token, balance: newTotalAmount})
    } else {
      userTokenBalances.push({user: account, token: token, balance: amount})
    }
  }
}

function _unsafeSubtractFromBalance(account: AccountId, token: AccountId, amount: i32): void {
  for(let i: u64 = 0; i < <u64>userTokenBalances.length; i++) {
    if(userTokenBalances[<i32>i].user == account && userTokenBalances[<i32>i].token == token) {
      let userCurrent = userTokenBalances[<i32>i].balance
      let newUserAmount = userCurrent - amount
      userTokenBalances.replace(<i32>i, {user: account, token: token, balance: newUserAmount})
    }
    if(userTokenBalances[<i32>i].user == TOTAL && userTokenBalances[<i32>i].token == token) {
      let totalCurrent = userTokenBalances[<i32>i].balance
      let newTotalAmount = totalCurrent - amount
      userTokenBalances.replace(<i32>i, {user: TOTAL, token: token, balance: newTotalAmount})
    }
  }
}


function _unsafeInternalTransfer(from: AccountId, to: AccountId, token: AccountId, amount: i32): void {
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
  let proposal = proposals[proposalQueue[proposalIndex]]
  let firstAdd = proposal.sP + storage.getSome<i32>('votingPeriodLength')
  assert(getCurrentPeriod() >= (firstAdd + storage.getSome<i32>('gracePeriodLength')), ERR_NOT_READY)
  assert(proposal.f[1] == false, ERR_PROPOSAL_PROCESSED)
  assert(proposalIndex == 0 || proposals[proposalQueue[proposalIndex - 1]].f[1], ERR_PREVIOUS_PROPOSAL)
  return proposal
}

function _didPass(proposal: Proposal): bool {
 // let proposal = proposals[proposalQueue[proposalIndex]]

  let didPass = proposal.yV > proposal.nV

  // Make the proposal fail if the dilutionBound is exceeded 
  if(((totalShares + totalLoot) * storage.getSome<i32>('dilutionBound')) < proposal.mT) {
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
  _unsafeInternalTransfer(ESCROW, Context.predecessor, depositToken, storage.getSome<i32>('processingReward'))
  _unsafeInternalTransfer(ESCROW, s, depositToken, storage.getSome<i32>('proposalDeposit') - storage.getSome<i32>('processingReward'))
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

  for(let i: u64 = 0; i < <u64>approvedTokens.length; i++) {
    let amountToRagequit = _fairShare(getUserTokenBalance(GUILD, approvedTokens[<i32>i]), sharesAndLootToBurn, initialTotalSharesAndLoot)
    if (amountToRagequit > 0) { //gas optimization to allow a higher maximum token limit
      //deliberately not using safemath here to keep overflows from preventing the function execution (which would break ragekicks)
      //if a token overflows, it is because the supply was artificially inflated to oblivion, so we probably don't care about it anyways
      let current =  getUserTokenBalance(GUILD, approvedTokens[<i32>i])
      let modifiedDown = current - amountToRagequit
      let modifiedUp = current + amountToRagequit

      let newTokenBalance = new userTokenBalanceInfo()
      newTokenBalance.user = GUILD
      newTokenBalance.token = approvedTokens[<i32>i]
      newTokenBalance.balance = modifiedDown
      let downUserIndex = getUserTokenBalanceIndex(GUILD)
      if(downUserIndex >= 0) {
        userTokenBalances.replace(downUserIndex, newTokenBalance)
      }

      let upTokenBalance = new userTokenBalanceInfo()
      upTokenBalance.user = memberAddress
      upTokenBalance.token = approvedTokens[<i32>i]
      upTokenBalance.balance = modifiedUp
      let upUserIndex = getUserTokenBalanceIndex(memberAddress)
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

  for(let i: u64 = 0; i < <u64>tokens.length; i++) {
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

export function getMemberStatus(member: AccountId): bool {
  if(members.get(member)){
    return true
  }
  return false
}

export function getMemberInfo(member: AccountId): Array<Member> {
  let thisMember = new Array<Member>()
  let aMember = members.get(member, new Member('', 0, 0, false, 0, 0))!
  thisMember.push(aMember)
  return thisMember
}

export function getCurrentPeriod(): i32 {
  let summonTime = storage.getSome<u64>('summoningTime') // blockIndex that dao was summoned
  let pd = storage.getSome<i32>('periodDuration') // duration in seconds for each period
  if(pd != 0) {
    return <i32>((Context.blockIndex - summonTime) / pd)
  }
  return 0
}

export function isVotingPeriod(pI: i32): bool {
  let proposal = proposals[pI]
  if((getCurrentPeriod() <= (proposal.sP + storage.getSome<i32>('votingPeriodLength'))) && getCurrentPeriod() >= proposal.sP){
    return true
  } else {
    return false
  }
}

export function isGracePeriod(pI: i32): bool {
  let proposal = proposals[pI]
  let votingPeriod = proposal.sP + storage.getSome<i32>('votingPeriodLength')
  let endGP = votingPeriod + storage.getSome<i32>('gracePeriodLength')
  if(getCurrentPeriod() <= endGP && getCurrentPeriod() > votingPeriod){
    return true
  } else {
    return false
  }
}

export function getProposalQueueLength(): i32 {
  return proposalQueue.length
}

export function getProposalFlags(pI: i32): bool[] {
  return proposals[pI].f
}

export function getUserTokenBalance(user: AccountId, token: AccountId): i32 {
  for(let i: u64 = 0; i < <u64>userTokenBalances.length; i++) {
    if(userTokenBalances[<i32>i].user == user && userTokenBalances[<i32>i].token == token) {
      return userTokenBalances[<i32>i].balance
    }
  }
  return 0
}

export function getUserTokenBalanceObject(): PersistentVector<userTokenBalanceInfo> {
  return userTokenBalances
}

export function getGuildTokenBalances(): Array<TokenBalances> {
  let balances = new Array<TokenBalances>()
  for (let i: u64 = 0; i < <u64>approvedTokens.length; i++) {
    let balance = _getGuildIndivTokenBalances(approvedTokens[<i32>i])
    balances.push({token: approvedTokens[<i32>i], balance: balance})
  }
  return balances
}

function _getGuildIndivTokenBalances(token: AccountId): i32 {
  return getUserTokenBalance(GUILD, token)
}

export function getEscrowTokenBalances(): Array<TokenBalances> {
  let balances = new Array<TokenBalances>()
  for (let i: u64 = 0; i < <u64>approvedTokens.length; i++) {
    let balance = _getEscrowIndivTokenBalances(approvedTokens[<i32>i])
    balances.push({token: approvedTokens[<i32>i], balance: balance})
  }
  return balances
}

function _getEscrowIndivTokenBalances(token: AccountId): i32 {
  return getUserTokenBalance(ESCROW, token)
}

export function getMemberProposalVote(memberAddress: AccountId, pI: i32): string {
  for(let i: u64 = 0; i < <u64>votesByMember.length; i++){
    if(votesByMember[<i32>i].user == memberAddress && votesByMember[<i32>i].pI == pI){
      return votesByMember[<i32>i].vote
    }
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
  for (let i: u64 = 0; i < <u64>proposals.length; i++) {
    if (proposals[<i32>i].pI == pI) {
      return <i32>i
    }
  }
  return -1
}

export function getUserTokenBalanceIndex(user: AccountId): i32 {
  for (let i: u64 = 0; i < <u64>userTokenBalances.length; i++) {
    if (userTokenBalances[<i32>i].user == user) {
      return <i32>i
    }
  }
  return -1
}

function _max(x: i32, y: i32): i32 {
  return x >= y ? x : y
}

/**
 * returns all Proposal Events
 */
export function getAllProposalEvents(): Array<SPE> {
  let _frList = new Array<SPE>();
  if(submitProposalEvents.length != 0) {
    for(let i: u64 = 0; i < <u64>submitProposalEvents.length; i++) {
      _frList.push(submitProposalEvents[<i32>i]);
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

  //_sT(tO, tT)  

  _unsafeAddToBalance(ESCROW, tT, tO)

  let f = new Array<bool>(7) // [sed, processed, didPass, cancelled, whitelist, guildkick, member]
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
  let ftAPI = new tokenAPI()
  ftAPI.incAllowance(new u128(tO), tT)
  ftAPI.transferFrom(Context.sender, MOLOCH_CONTRACT_ACCOUNT, new u128(tO), tT)
}


export function submitWhitelistProposal(tokenToWhitelist: string): void {
  assert(env.isValidAccountID(tokenToWhitelist), ERR_INVALID_ACCOUNT_ID)
  assert(!tokenWhiteList.getSome(tokenToWhitelist), ERR_ALREADY_WHITELISTED)
  assert(approvedTokens.length < MAX_TOKEN_WHITELIST_COUNT, ERR_TOO_MANY_WHITELISTED)

  let f = new Array<bool>(7) // [sed, processed, didPass, cancelled, whitelist, guildkick]
  f[4] = true; // whitelist
  _submitProposal('', 0, 0, 0, tokenToWhitelist, 0, '', f)
}


export function submitGuildKickProposal(memberToKick: AccountId): void {
  let member = members.getSome(memberToKick)
  assert(member.shares > 0 || member.loot > 0, ERR_SHAREORLOOT)
  assert(member.jailed == 0, ERR_JAILED)

  let f = new Array<bool>(7) // [sed, processed, didPass, cancelled, whitelist, guildkick]
  f[5] = true; // guild kick
  
  _submitProposal(memberToKick, 0, 0, 0, '', 0, '', f)
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
    Context.blockIndex
  ))
  votesByMember.push({user: Context.predecessor, pI: pI, vote: ''})
  let mA: AccountId
  if(memberAddressByDelegatekey.get(Context.sender)!=null) {
    mA = memberAddressByDelegatekey.getSome(Context.sender)
  } else {
    mA = Context.sender
  }

  sPE(pI, a, sR, lR, tO, tT, pR, pT, f, Context.predecessor, mA, Context.blockIndex )
}


export function sponsorProposal(pI: i32, proposalDeposit: i32, depositToken: AccountId): void {
 
  assert(onlyDelegate(Context.predecessor), 'not a delegate')
  // collect proposal deposit from s and store it in the Moloch until the proposal is processed

  //_sT(proposalDeposit, depositToken)

  _unsafeAddToBalance(ESCROW, depositToken, proposalDeposit)

  let proposal = proposals[pI]
  assert(proposal.pI == pI, 'not right proposal')
  assert(env.isValidAccountID(proposal.p), 'invalid account ID')
  assert(!proposal.f[0], 'already sed')
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
  let max: i32 = _max(
    getCurrentPeriod(), 
    proposalQueue.length == 0 ? 0 : proposals[proposalQueue[proposalQueue.length - 1]].sP
  )
  let sP: i32 = max + 1

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
  
  //proposals.replace(pI, proposal)  
  proposals[pI] = proposal
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
  let proposal = proposals[proposalQueue[pI]]

  assert(vote == 'abstain' || vote == 'yes' || vote=='no', ERR_VOTE_INVALID)
  assert(getCurrentPeriod() >= proposal.sP, ERR_VOTING_NOT_STARTED)
  assert(!hasVotingPeriodExpired(proposal.sP), ERR_VOTING_PERIOD_EXPIRED)
  
  let existingVote = getMemberProposalVote(Context.predecessor, pI)

  assert(existingVote == 'no vote yet', ERR_ALREADY_VOTED)

  votesByMember.push({user: Context.predecessor, pI: pI, vote: vote})

  if(vote == 'yes') {
    let newyV = proposal.yV + member.shares

    //set highest index (latest) yes vote - must be processed for member to ragequit
    if(pI > member.highestIndexYesVote) {
      member.highestIndexYesVote = pI
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
    proposals[pI] = proposal

  } else if (vote == 'no') {
    let newnV = proposal.nV + member.shares

    proposal.nV = newnV

 //   proposals.replace(pI, proposal)
 proposals[pI] = proposal 
  }

  // NOTE: subgraph indexes by proposalId not proposalIndex since proposalIndex isn't set until it's been sed but proposal is created on submission
  submitVoteEvent(proposalQueue[pI], Context.predecessor, memberAddress, vote)
 
  getUsedGas()
  getUsedStorage()
}


export function processProposal(pI: i32): bool {

  let proposal = _vPP(pI)
  
  //let proposalId = proposalQueue[pI]
  //let proposal = proposals[proposalId]
  
  assert(!proposal.f[4] && !proposal.f[5], ERR_STANDARD_PROPOSAL)

  let f = proposal.f // [sed, processed, didPass, cancelled, whitelist, guildkick, member]
  f[1] = true; //processed

  proposal.f = f
  //proposals.replace(pI, proposal)
  proposals[pI] = proposal

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
    proposalPassed(pI, proposal)
  } else {
    proposalFailed(pI, proposal)
  }
  getUsedGas()
  getUsedStorage()
  return didPass
}

  export function proposalPassed(proposalId: i32, proposal: Proposal): void {

   // let proposalId = proposalQueue[pI]
   // let proposal = proposals[proposalId]

    let f = proposal.f // [sed, processed, didPass, cancelled, whitelist, guildkick]
    f[2] = true; //didPass
    proposal.f = f
    //proposals.replace(proposalId, proposal)
    proposals[proposalId] = proposal

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

    _unsafeInternalTransfer(ESCROW, GUILD, proposal.tT, proposal.tO)
    _unsafeInternalTransfer(GUILD, proposal.a, proposal.pT, proposal.pR)

    // if the proposal spends 100% of guild bank balance for a token, decrement total guild bank tokens
    if(getUserTokenBalance(GUILD, proposal.pT) == 0 && proposal.pR > 0) {
      totalGuildBankTokens = totalGuildBankTokens -1
    }
    processProposalEvent(proposalId, true)
  }

export function proposalFailed(proposalId: i32, proposal: Proposal): void {

  //let proposalId = proposalQueue[pI]
  //let proposal = proposals[proposalId]
   
  //return all tokens to the p (not the a, because funds come from the p)
  _unsafeInternalTransfer(ESCROW, proposal.p, proposal.tT, proposal.tO)
  
  _returnDeposit(proposal.s)

  processProposalEvent(proposalId, false)
}


export function processWhitelistProposal(pI: i32): void {

  _vPP(pI)

  let proposalId = proposalQueue[pI]
  let proposal = proposals[proposalId]

  assert(proposal.f[4], ERR_WHITELIST_PROPOSAL)

  let f = proposal.f // [sed, processed, didPass, cancelled, whitelist, guildkick]
  f[1] = true; //processed
  proposal.f = f
  //proposals.replace(proposalId,proposal)
  proposals[proposalId] = proposal

  let didPass = _didPass(proposal)

  if(approvedTokens.length >= MAX_TOKEN_WHITELIST_COUNT) {
    didPass = false
  }

  if (didPass) {
    let f = proposal.f // [sed, processed, didPass, cancelled, whitelist, guildkick]
    f[2] = true; //didPass
    proposal.f = f
    //proposals.replace(proposalId, proposal)
    proposals[proposalId] = proposal

    tokenWhiteList.set(proposal.tT, true)
    approvedTokens.push(proposal.tT)
  }

  proposedToWhiteList.set(proposal.tT, false)

  _returnDeposit(proposal.s)

  processWhiteListProposalEvent(pI, proposalId, didPass)
  
}


export function processGuildKickProposal(pI: i32): void {

  _vPP(pI)

  let proposalId = proposalQueue[pI]
  let proposal = proposals[proposalId]

  assert(proposal.f[5], ERR_GUILD_PROPOSAL)

  let f = proposal.f // [sed, processed, didPass, cancelled, whitelist, guildkick]
    f[1] = true; //processed
   
    proposal.f = f
    //proposals.replace(proposalId, proposal)
    proposals[proposalId] = proposal

  let didPass = _didPass(proposal)

  if(didPass) {
    let f = proposal.f // [sed, processed, didPass, cancelled, whitelist, guildkick]
    f[2] = true; //didPass

    proposal.f = f
   // proposals.replace(proposalId, proposal)
    proposals[proposalId] = proposal


    let member = members.getSome(proposal.a)

    let updateMember = new Member(
    member.delegateKey,
    0, // revoke all shares
    member.loot + member.shares, //transfer shares to loot
    true,
    member.highestIndexYesVote,
    proposalId
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

  
  
  
  
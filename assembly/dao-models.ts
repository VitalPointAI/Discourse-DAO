import { u128, PersistentMap, PersistentVector } from 'near-sdk-as'
import { AccountId, Amount } from './dao-types'

// Data Types and Storage

export const userTokenBalances = new PersistentVector<userTokenBalanceInfo>('u') //maps user to token to amount
export type votesByMember = PersistentVector<UserVote>
export const votesByMember = new PersistentVector<UserVote>('v') // maps user to proposal to vote on that proposal
export const tokenWhiteList = new PersistentMap<string, bool>('tw') // maps token name to whether it is whitelisted or not
export const proposedToWhiteList = new PersistentMap<string, bool>('pw') // maps token name to whether it has been proposed for white listing or not
export const proposedToKick = new PersistentMap<string, bool>('pk') // maps user account to whether it has been proposed to kick or not
export const members = new PersistentMap<string, Member>('m') // maps account to its Member model
export const memberAddressByDelegatekey = new PersistentMap<string, string>('md') // maps account to delegate key
export const proposals = new PersistentVector<Proposal>('p') // array of proposals - use vector as provides index and length
export const proposalQueue = new PersistentVector<i32>('pq') // proposal queue
export const approvedTokens = new PersistentVector<AccountId>('a') // array of approvedtokens


@nearBindgen
export class Votes {
    yes: i32;
    no: i32;
}

@nearBindgen
export class UserVote {
    user: string;
    pI: i32;
    vote: string;
}

@nearBindgen
export class userTokenBalanceInfo {
    user: string;
    token: string;
    balance: i32;
}

@nearBindgen
export class TokenBalances {
    token: string;
    balance: i32;
}

@nearBindgen
export class Member {
    delegateKey: string; // the key responsible for submitting proposals and voting - defaults to member address unless updated
    shares: i32; // the # of voting shares assigned to this member
    loot: i32; // the loot amount available to this member (combined with shares on ragequit)
    existing: bool; // always true once a member has been created
    highestIndexYesVote: i32; // highest proposal index # on which the member voted YES
    jailed: i32; // set to proposalIndex of a passing guild kick proposal for this member, prevents voting on and sponsoring proposals

    constructor(
        delegateKey: string,
        shares: i32,
        loot: i32,
        existing: bool,
        highestIndexYesVote: i32,
        jailed: i32) {
            this.delegateKey = delegateKey;
            this.shares = shares;
            this.loot = loot;
            this.existing = existing;
            this.highestIndexYesVote = highestIndexYesVote;
            this.jailed = jailed;
        }
    
}

@nearBindgen
export class Proposal {
    pI: i32; // frontend generated id to link record to proposal details
    a: AccountId; // the applicant who wishes to become a member - this key will be used for withdrawals (doubles as guild kick target for gkick proposals)
    p: AccountId; // the account that submitted the proposal (can be non-member)
    s: AccountId; // the member that sponsored the proposal (moving it into the queue)
    sR: i32; // the # of shares the applicant is requesting
    lR: i32; // the amount of loot the applicant is requesting
    tO: i32; // amount of tokens offered as tribute
    tT: AccountId; // tribute token contract reference
    pR: i32; // amount of tokens requested as payment
    pT: AccountId; // payment token contract reference
    sP: i32; // the period in which voting can start for this proposal
    yV: i32; // the total number of YES votes for this proposal
    nV: i32; // the total number of NO votes for this proposal
    f: Array<bool>; // [sponsored, processed, didPass, cancelled, whitelist, guildkick
    mT: i32; // the maximum # of total shares encountered at a yes vote on this proposal
    pS: u64; // blockindex when proposal was submitted

    constructor (
        proposalIdentifier: i32, // id to link record to proposal details
        applicant: AccountId, // the applicant who wishes to become a member - this key will be used for withdrawals (doubles as guild kick target for gkick proposals)
        proposer: AccountId, // the account that submitted the proposal (can be non-member)
        sponsor: AccountId, // the member that sponsored the proposal (moving it into the queue)
        sharesRequested: i32, // the # of shares the applicant is requesting
        lootRequested: i32, // the amount of loot the applicant is requesting
        tributeOffered: i32, // amount of tokens offered as tribute
        tributeToken: AccountId, // tribute token contract reference
        paymentRequested: i32, // amount of tokens requested as payment
        paymentToken: AccountId, // payment token contract reference
        startingPeriod: i32, // the period in which voting can start for this proposal
        yesVotes: i32, // the total number of YES votes for this proposal
        noVotes: i32, // the total number of NO votes for this proposal
        flags: Array<bool>, // [sponsored, processed, didPass, cancelled, whitelist, guildkick
        maxTotalSharesAndLootAtYesVote: i32, // the maximum # of total shares encountered at a yes vote on this proposal
        proposalSubmission: u64 // blockindex when proposal was submitted
    ){
        this.pI = proposalIdentifier;
        this.a = applicant;
        this.p = proposer;
        this.s = sponsor;
        this.sR = sharesRequested;
        this.lR = lootRequested;
        this.tO = tributeOffered;
        this.tT = tributeToken;
        this.pR = paymentRequested;
        this.pT = paymentToken;
        this.sP = startingPeriod;
        this.yV = yesVotes;
        this.nV = noVotes;
        this.f = flags;
        this.mT = maxTotalSharesAndLootAtYesVote;
        this.pS = proposalSubmission;
    }
}

// Cross Contract API Models

@nearBindgen
export class TransferFromArgs {
    owner_id: string;
    new_owner_id: string;
    amount: u128;
}

@nearBindgen
export class IncAllowanceArgs {
    escrow_account_id: string;
    amount: u128;
}

@nearBindgen
export class BalanceArgs {
   account: string;
}
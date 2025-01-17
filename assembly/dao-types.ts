import { u128 } from 'near-sdk-as'

export type AccountId = string
export type Amount = u128


// Global Constants
export type PeriodDuration = i32 // default = 17280 = 4.8 hours in seconds (5 periods per day) - NEAR - default = ~1 block/second (92 blocks/min) 5520 blocks/hour = 22080 (4 hours) = 6 periods/day
export type VotingPeriodLength = i32 // default = 35 periods (7 days) - NEAR - default = 42 periods (7 days)
export type GracePeriodLength = i32 // default = 35 periods (7 days) = NEAR default = 42 periods (7 days)
export type ProposalDeposit = i32 // default = 10 ETH (~$1,000 worth of ETH at contract deployment)
export type DilutionBound = i32 // default = 3 - maximum multiplier a YES voter will be obligated to pay in case of mass ragequit
export type ProcessingReward = i32 // default = 0.1 - amount of ETH to give to whomever processes a proposal
export type SummoningTime = u64 // needed to determine the current period - Near - current blockindex
export type MinSharePrice = i32 // minimum share price

export type DepositToken = string // default = vpc.vitalpointai.testnet


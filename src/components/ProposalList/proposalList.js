import React, { useState, useEffect } from 'react'
import ProposalsTable from '../ProposalsTable/proposalsTable'
import VotingListTable from '../votingTable/votingTable'
import QueueTable from '../QueueTable/queueTable'
import ProcessedTable from '../ProcessedTable/processedTable'
import BalanceChart from '../BalanceGraphs/balanceGraph'
import DistributionGraph from '../DistributionGraph/distributionGraph'

// Material UI Components
import { makeStyles, useTheme } from '@material-ui/core/styles'
import useMediaQuery from '@material-ui/core/useMediaQuery'
import TabContext from '@material-ui/lab/TabContext'
import Tab from '@material-ui/core/Tab'
import TabList from '@material-ui/lab/TabList'
import TabPanel from '@material-ui/lab/TabPanel'
import AppBar from '@material-ui/core/AppBar'
import Typography from '@material-ui/core/Typography'

const useStyles = makeStyles({
  appBar: {
      font: '70%'
  }
});

export default function ProposalList(props) {
  const[loaded, setLoaded] = useState(false)
  const[proposalCount, setProposalCount] = useState(0)
  const[votingCount, setVotingCount] = useState(0)
  const[queueCount, setQueueCount] = useState(0)
  const[processCount, setProcessCount] = useState(0)

  const classes = useStyles()
  const theme = useTheme()
  const matches = useMediaQuery(theme.breakpoints.only('xs'))
  const { 
    accountId, 
    tabValue,
    handleTabValueState,
    handleProposalEventChange,
    handleGuildBalanceChanges,
    handleEscrowBalanceChanges,
    proposalEvents,
    memberStatus,
    depositToken,
    proposalDeposit
  } = props

  const proposalTabLabel = 'Proposals ('+ proposalCount + ')'
  const votingTabLabel = 'Voting (' + votingCount + ')'
  const queueLabel = 'Queued (' + queueCount + ')'
  const processedLabel = 'Processed (' + processCount +')'

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  function handleProposalCountChange(newCount) {
    setProposalCount(newCount)
  }

  function handleVotingCountChange(newCount) {
    setVotingCount(newCount)
  }

  function handleProcessCountChange(newCount) {
    setProcessCount(newCount)
  }

  function handleQueueCountChange(newCount) {
    setQueueCount(newCount)
  }

  const handleChangeRowsPerPage = (event) => {
      setRowsPerPage(parseInt(event.target.value, 10));
      setPage(0);
  };

  const handleTabChange = (event, newValue) => {
      handleTabValueState(newValue);
  };

  let allProposalsList = []

  if (proposalEvents.length > 0) {
    proposalEvents.map((fr, i) => {
          
            allProposalsList.push([{blockIndex: fr.pS, applicant: fr.a, proposer: fr.dK, requestId: parseInt(fr.pI), shares: fr.sR, loot: fr.lR, tribute: fr.tO}])      

      })
    
  }
    
  return (
    <>
    <TabContext value={tabValue}>
        <AppBar position="static">
        {!matches 
          ? <TabList onChange={handleTabChange} aria-label="simple tabs example" variant="fullWidth">
              <Tab className="appBar" label={proposalTabLabel} value="1" align="left" />
              <Tab label={votingTabLabel} value="2"/>
              <Tab label={queueLabel} value="3" />
              <Tab label={processedLabel} value="4" />
            </TabList>
          : <TabList onChange={handleTabChange} aria-label="simple tabs example">
              <Tab className="appBar" label={proposalTabLabel} value="1" />
              <Tab label={votingTabLabel} value="2"/>
              <Tab label={queueLabel} value="3" />
              <Tab label={processedLabel} value="4" />
            </TabList>
        }
    </AppBar>
      <TabPanel value="1">{(allProposalsList.length > 0 ? <ProposalsTable 
        allProposalsList={allProposalsList} 
        loaded={loaded} 
        eventCount={allProposalsList.length} 
        matches={matches} 
        accountId={accountId} 
        memberStatus={memberStatus}
        depositToken={depositToken}
        proposalDeposit={proposalDeposit}
        handleProposalCountChange={handleProposalCountChange}
        handleProposalEventChange={handleProposalEventChange}
        handleGuildBalanceChanges={handleGuildBalanceChanges}
        handleEscrowBalanceChanges={handleEscrowBalanceChanges}
        /> : 'No Proposals')}</TabPanel>

      <TabPanel value="2">{(allProposalsList.length > 0 ? <VotingListTable 
        allProposalsList={allProposalsList} 
        eventCount={allProposalsList.length}  
        matches={matches} 
        accountId={accountId} 
        memberStatus={memberStatus}
        depositToken={depositToken}
        proposalDeposit={proposalDeposit}
        handleVotingCountChange={handleVotingCountChange}
        handleProposalEventChange={handleProposalEventChange}
        handleGuildBalanceChanges={handleGuildBalanceChanges}
        handleEscrowBalanceChanges={handleEscrowBalanceChanges}
        /> : <div style={{marginTop: 10, marginBottom: 10}}>No Proposals Ready for Voting</div>)}</TabPanel>

      <TabPanel value="3">{(allProposalsList.length > 0 ? <QueueTable 
        allProposalsList={allProposalsList} 
        eventCount={allProposalsList.length} 
        matches={matches} 
        accountId={accountId}
        memberStatus={memberStatus}
        depositToken={depositToken}
        proposalDeposit={proposalDeposit}
        handleQueueCountChange={handleQueueCountChange}
        handleProposalEventChange={handleProposalEventChange}
        handleGuildBalanceChanges={handleGuildBalanceChanges}
        handleEscrowBalanceChanges={handleEscrowBalanceChanges}
        /> : <div style={{marginTop: 10, marginBottom: 10}}>No Guild Kick Proposals</div>)}</TabPanel>

      <TabPanel value="4">{(allProposalsList.length > 0 ? <ProcessedTable 
        allProposalsList={allProposalsList} 
        eventCount={allProposalsList.length} 
        matches={matches} 
        accountId={accountId}
        memberStatus={memberStatus}
        depositToken={depositToken}
        proposalDeposit={proposalDeposit}
        handleProcessCountChange={handleProcessCountChange}
        handleProposalEventChange={handleProposalEventChange}
        handleGuildBalanceChanges={handleGuildBalanceChanges}
        handleEscrowBalanceChanges={handleEscrowBalanceChanges}
        /> : <div style={{marginTop: 10, marginBottom: 10}}>No Processed Proposals</div>)}</TabPanel>
      </TabContext>
    </>
  )
}
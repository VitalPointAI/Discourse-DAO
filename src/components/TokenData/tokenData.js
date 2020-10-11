import React, { useState, useEffect } from 'react'
import LogoutButton from '../../components/common/LogoutButton/logoutButton'
import ActionSelector from '../ActionSelector/actionSelector'
import ProposalList from '../ProposalList/proposalList'
import BalanceChart from '../BalanceGraphs/balanceGraph'

// Material UI imports
import { makeStyles } from '@material-ui/core/styles'
import Card from '@material-ui/core/Card'
import CardContent from '@material-ui/core/CardContent'
import Typography from '@material-ui/core/Typography'
import Grid from '@material-ui/core/Grid'
import Divider from '@material-ui/core/Divider'
import Paper from '@material-ui/core/Paper'
import Chip from '@material-ui/core/Chip'
import AccountCircleTwoToneIcon from '@material-ui/icons/AccountCircleTwoTone'
import AccountBalanceWalletTwoToneIcon from '@material-ui/icons/AccountBalanceWalletTwoTone'
import Tooltip from '@material-ui/core/Tooltip'

const useStyles = makeStyles((theme) => ({
    root: {
      
    },
    paper: {
      padding: theme.spacing(2),
      textAlign: 'center',
      color: theme.palette.text.secondary,
    },
    bullet: {
      display: 'inline-block',
      margin: '0 2px',
      transform: 'scale(0.8)',
    },
    title: {
      fontSize: 14,
    },
    pos: {
      marginBottom: 12,
    },
    customCard: {
        maxWidth: 275,
        margin: 'auto',
        padding: 20
    },
  }));

  
export default function TokenData(props) {
    const [graphData, setGraphData] = useState([])
    
    const classes = useStyles()
    

    const {      
      tabValue,
      handleTabValueState, 
      accountId,
      memberStatus,
      depositToken,
      proposalDeposit,
      guildBalance,
      escrowBalance,
      proposalEvents,
      handleProposalEventChange,
      handleGuildBalanceChanges,
      handleEscrowBalanceChanges,
      summoner,
      currentPeriod,
      tokenName,
      userBalance, 
      minSharePrice } = props

    let guildRow
    if(guildBalance) {
    for (let i = 0; i < guildBalance.length; i++) {
      guildRow = (
        <li>{guildBalance[i].token} : {guildBalance[i].balance}</li>
      )
    }
    } else { 
      guildRow = 'no guild balance'
    }
    const thisGuildBalance = (
      <Card>
        <CardContent>
        {guildRow}
        </CardContent>
      </Card>
      )

    let escrowRow
    if(escrowBalance) {
    for (let i = 0; i < escrowBalance.length; i++) {
      escrowRow = (
        <li>{escrowBalance[i].token} : {escrowBalance[i].balance}</li>
      )
    }
  } else {
    escrowRow = 'no escrow balance'
  }
    const thisEscrowBalance = (
      <Card>
        <CardContent>
        {escrowRow}
        </CardContent>
      </Card>
      )

    return (
       
        <Grid container>
        <Grid item xs={12}>
          <Paper className={classes.paper}>
          <Grid container >
            
            <Grid item xs={12} sm={12} md={12} lg={12} xl={12}>
              <LogoutButton accountId={accountId} />
            </Grid>
           
          </Grid>
           

            <Grid container direction="row" justify="space-evenly" style={{marginBottom:10, marginTop: 10}}>
                <Grid item xs={10} sm={6} md={4} lg={3} xl={3} >
                Current Period: {currentPeriod} | {accountId}: {memberStatus ? 'member' : 'not member'} | {depositToken} Balance: {userBalance}
                     <ActionSelector 
                        handleProposalEventChange={handleProposalEventChange}
                        handleEscrowBalanceChanges={handleEscrowBalanceChanges}
                        handleGuildBalanceChanges={handleGuildBalanceChanges}
                        handleTabValueState={handleTabValueState}
                        accountId={accountId}
                        tokenName={tokenName}
                        depositToken={depositToken}
                        minSharePrice={minSharePrice}
                      /> 
                </Grid>
            </Grid>

            <Grid container>
              <Grid item xs={12} sm={6} md={6} lg={6} xl={6} >
              <Typography component="h4">Guild Balances</Typography>
                {thisGuildBalance}
              </Grid>
              <Grid item xs={12} sm={6} md={6} lg={6} xl={6} >
              <Typography component="h4">Escrow Balances</Typography>
               {thisEscrowBalance}
              </Grid>
            </Grid>
        
            <Grid container>
              <Grid item xs={12} sm={12} md={12} lg={12} xl={12} >
                <ProposalList 
                  accountId={accountId} 
                  guildBalance={guildBalance}
                  handleTabValueState={handleTabValueState}
                  tabValue={tabValue}
                  handleProposalEventChange={handleProposalEventChange}
                  handleGuildBalanceChanges={handleGuildBalanceChanges}
                  handleEscrowBalanceChanges={handleEscrowBalanceChanges}
                  proposalEvents={proposalEvents}
                  memberStatus={memberStatus}
                  proposalDeposit={proposalDeposit}
                  depositToken={depositToken}
                />
              </Grid>
            </Grid>
              
     
      <Divider style={{marginBottom: 10}}/>

       <Grid container className={classes.root} spacing={1}>
        <Grid item xs={6} sm={6} md={6} lg={6} xl={6}>
          
         
          
    
        </Grid>

        <Grid item xs={6} sm={6} md={6} lg={6} xl={6}>
         <Typography variant="button" display="block">Summoner</Typography>
         
           <Chip variant="outlined" icon={<AccountCircleTwoToneIcon />} label={summoner} />
 
        </Grid>
      </Grid>

     </Paper>
     </Grid>
   </Grid>
      
    )
    
}
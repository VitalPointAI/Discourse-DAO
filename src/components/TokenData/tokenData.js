import React, { useState, useEffect } from 'react'
import LogoutButton from '../../components/common/LogoutButton/logoutButton'
import ActionSelector from '../ActionSelector/actionSelector'
import ProposalList from '../ProposalList/proposalList'
import BalanceChart from '../BalanceGraphs/balanceGraph'
import Footer from '../common/Footer/footer'

// Material UI imports
import { makeStyles } from '@material-ui/core/styles'
import clsx from 'clsx';
import Card from '@material-ui/core/Card';
import CardHeader from '@material-ui/core/CardHeader';
import CardMedia from '@material-ui/core/CardMedia';
import CardContent from '@material-ui/core/CardContent';
import CardActions from '@material-ui/core/CardActions';
import Collapse from '@material-ui/core/Collapse';
import Avatar from '@material-ui/core/Avatar';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import IconButton from '@material-ui/core/IconButton';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import { red } from '@material-ui/core/colors';
import Typography from '@material-ui/core/Typography'
import Grid from '@material-ui/core/Grid'
import Divider from '@material-ui/core/Divider'
import Paper from '@material-ui/core/Paper'
import Chip from '@material-ui/core/Chip'
import AccountCircleTwoToneIcon from '@material-ui/icons/AccountCircleTwoTone'
import AccessTimeIcon from '@material-ui/icons/AccessTime';
import AccountBalanceWalletTwoToneIcon from '@material-ui/icons/AccountBalanceWalletTwoTone'
import Tooltip from '@material-ui/core/Tooltip'
import FavoriteIcon from '@material-ui/icons/Favorite';
import ShareIcon from '@material-ui/icons/Share';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import NotInterestedIcon from '@material-ui/icons/NotInterested';

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
    centered: {
      display: 'flex',
      justifyContent: 'center',
      width: '100%',
      alignItems: 'center',
      marginBottom: '25px'
  },
    customCard: {
        maxWidth: 275,
        margin: 'auto',
        padding: 20
    },
    media: {
      height: 0,
      paddingTop: '35.25%', // 16:9
    },
    expand: {
      transform: 'rotate(0deg)',
      marginLeft: 'auto',
      transition: theme.transitions.create('transform', {
        duration: theme.transitions.duration.shortest,
      }),
    },
    expandOpen: {
      transform: 'rotate(180deg)',
    },
    avatar: {
      backgroundColor: red[500],
    },
  }));

  
export default function TokenData(props) {
    const [graphData, setGraphData] = useState([])
    const [guildExpanded, setGuildExpanded] = useState(false);
    const [escrowExpanded, setEscrowExpanded] = useState(false);
    
    const classes = useStyles()
    

    const {      
      tabValue,
      handleTabValueState, 
      accountId,
      memberStatus,
      memberInfo,
      depositToken,
      tributeToken,
      tributeOffer,
      processingReward,
      proposalDeposit,
      guildBalance,
      escrowBalance,
      proposalEvents,
      handleProposalEventChange,
      handleGuildBalanceChanges,
      handleEscrowBalanceChanges,
      handleUserBalanceChanges,
      summoner,
      currentPeriod,
      periodDuration,
      tokenName,
      userBalance, 
      minSharePrice,
      proposalComments } = props

    const handleEscrowExpandClick = () => {
      setEscrowExpanded(!escrowExpanded);
    };

    const handleGuildExpandClick = () => {
      setGuildExpanded(!guildExpanded);
    };



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
  
    const memberIcon = memberStatus ? <CheckCircleIcon /> : <NotInterestedIcon />
    const sharesLabel = memberInfo ? 'Shares: ' + memberInfo[0].shares : 'Shares: 0'
    const lootLabel = memberInfo ? 'Loot: ' + memberInfo[0].loot : 'Loot: 0'
    const userBalanceLabel = 'Balances'

    return (
       <>
        <Grid container>
        <Grid item xs={12}>
          <Paper className={classes.paper}>
          <Grid container className={classes.centered}>
            <Grid item xs={2} sm={2} md={2} lg={2} xl={2}>
            <img src={require('../../assets/guild-logo-small.png')} style={{height: '75px', textAlign:'left'}}/>
            </Grid> 
            <Grid item xs={5} sm={5} md={5} lg={5} xl={5}>
              
                <ActionSelector 
                  handleProposalEventChange={handleProposalEventChange}
                  handleEscrowBalanceChanges={handleEscrowBalanceChanges}
                  handleGuildBalanceChanges={handleGuildBalanceChanges}
                  handleUserBalanceChanges={handleUserBalanceChanges}
                  handleTabValueState={handleTabValueState}
                  accountId={accountId}
                  tokenName={tokenName}
                  depositToken={depositToken}
                  minSharePrice={minSharePrice}
                />
            
            </Grid>
            <Grid item xs={5} sm={5} md={5} lg={5} xl={5}>
              <LogoutButton accountId={accountId} memberInfo={memberInfo} />
              <div style={{clear: 'both'}}/>
              <Chip variant="outlined" label={userBalanceLabel} style={{float:'right', marginTop: '5px'}}/>
              <Chip variant="outlined" label={sharesLabel} style={{float: 'right', marginTop: '5px', marginRight: '2px'}} />
              <Chip variant="outlined" label={lootLabel} style={{float: 'right', marginTop: '5px', marginRight: '2px'}} />
              <Chip variant="outlined" label="Member" icon={memberIcon} style={{float: 'right', marginTop: '5px', marginRight: '2px'}}/>
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
                  handleUserBalanceChanges={handleUserBalanceChanges}
                  proposalEvents={proposalEvents}
                  memberStatus={memberStatus}
                  proposalDeposit={proposalDeposit}
                  depositToken={depositToken}
                  tributeToken={tributeToken}
                  tributeOffer={tributeOffer}
                  processingReward={processingReward}
                  currentPeriod={currentPeriod}
                  periodDuration={periodDuration}
                  proposalComments={proposalComments}
                />
              </Grid>
            </Grid>
              
     
      <Divider style={{marginBottom: 10}}/>
      

  <Grid container spacing={2}>
    <Grid item xs={12} sm={4} md={4} lg={4} xl={4} >
    <Card>
    <CardHeader
        avatar={
          <Avatar aria-label="guild-balances" className={classes.avatar}>
            G
          </Avatar>
        }
        title="Guild Assets"
        subheader="by whitelisted token"
      />
      <CardMedia
        className={classes.media}
        image={require('../../assets/tokens.jpg')}
        title="Guild Assets"
      />
        <CardContent>
        </CardContent>
        <CardActions disableSpacing>
        <Typography variant="body2" color="textSecondary" component="p">
        Expand to View Balances
        </Typography>
        <IconButton
          className={clsx(classes.expand, {
            [classes.expandOpen]: guildExpanded,
          })}
          onClick={handleGuildExpandClick}
          aria-expanded={guildExpanded}
          aria-label="show balances"
        >
          <ExpandMoreIcon />
        </IconButton>
      </CardActions>
      <Collapse in={guildExpanded} timeout="auto" unmountOnExit>
        <CardContent>
          {thisGuildBalance}
        </CardContent>
      </Collapse>
      </Card>
    </Grid>
    <Grid item xs={12} sm={4} md={4} lg={4} xl={4}
      container
      direction="row"
      alignItems="flex-end"
      justify="center" >
      <div style={{width: '100%'}}>
        <Typography variant="h5" gutterBottom>DAO Info</Typography>
        <Divider style={{marginBottom: 10}}/>
      </div>
      <div style={{width: '100%'}}>
        <Typography variant="button" display="block">Current Period</Typography>
        <Chip variant="outlined" icon={<AccessTimeIcon />} label={currentPeriod} />
      </div>
      <div style={{width: '100%'}}>
        <Typography variant="button" display="block">Summoner</Typography>
        <Chip variant="outlined" icon={<AccountCircleTwoToneIcon />} label={summoner} />
      </div>
    
    </Grid>
    <Grid item xs={12} sm={4} md={4} lg={4} xl={4} >
    <Card>
    <CardHeader
        avatar={
          <Avatar aria-label="escrow-balances" className={classes.avatar}>
            E
          </Avatar>
        }
        title="Escrow Assets"
        subheader="by whitelisted token"
      />
      <CardMedia
        className={classes.media}
        image={require('../../assets/tokens-escrow1.jpg')}
        title="Escrow Assets"
      />
        <CardContent>
        </CardContent>
        <CardActions disableSpacing>
        <Typography variant="body2" color="textSecondary" component="p">
        Expand to View Balances
        </Typography>
        <IconButton
          className={clsx(classes.expand, {
            [classes.expandOpen]: escrowExpanded,
          })}
          onClick={handleEscrowExpandClick}
          aria-expanded={escrowExpanded}
          aria-label="show balances"
        >
          <ExpandMoreIcon />
        </IconButton>
      </CardActions>
      <Collapse in={escrowExpanded} timeout="auto" unmountOnExit>
        <CardContent>
        {thisEscrowBalance}
          
        </CardContent>
      </Collapse>
      </Card>
    </Grid>
  </Grid>
     </Paper>
     </Grid>
   </Grid>
   <Footer />
      </>
    )
    
}
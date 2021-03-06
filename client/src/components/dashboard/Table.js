import React from "react";
import ms from "ms";
import MaterialTable from "material-table";
import AddBox from "@material-ui/icons/AddBox";
import ArrowUpward from "@material-ui/icons/ArrowUpward";
import Check from "@material-ui/icons/Check";
import ChevronLeft from "@material-ui/icons/ChevronLeft";
import ChevronRight from "@material-ui/icons/ChevronRight";
import Clear from "@material-ui/icons/Clear";
import DeleteOutline from "@material-ui/icons/DeleteOutline";
import Edit from "@material-ui/icons/Edit";
import FilterList from "@material-ui/icons/FilterList";
import FirstPage from "@material-ui/icons/FirstPage";
import LastPage from "@material-ui/icons/LastPage";
import Remove from "@material-ui/icons/Remove";
import SaveAlt from "@material-ui/icons/SaveAlt";
import Search from "@material-ui/icons/Search";
import ViewColumn from "@material-ui/icons/ViewColumn";
import OfflineBolt from "@material-ui/icons/OfflineBolt";
import ArrowBackOutlinedIcon from "@material-ui/icons/ArrowBackOutlined";
import IconButton from "@material-ui/core/IconButton";
import { makeStyles } from "@material-ui/core/styles";

import CustomTheme from "../layout/CustomTheme";
import client from "../../apollo/client";

import {
  addDeck,
  removeDeck,
  getDeckId,
  updateDeckInDB
} from "../../apollo/deck";

import {
  cardsQuery,
  cardsQueryWithProgress,
  addCard,
  updateCardInDB,
  getCardId,
  removeCard
} from "../../apollo/card";

const tableIcons = {
  Add: AddBox,
  Check: Check,
  Clear: Clear,
  Delete: DeleteOutline,
  DetailPanel: ChevronRight,
  Edit: Edit,
  Export: SaveAlt,
  Filter: FilterList,
  FirstPage: FirstPage,
  LastPage: LastPage,
  NextPage: ChevronRight,
  PreviousPage: ChevronLeft,
  ResetSearch: Clear,
  Search: Search,
  SortArrow: ArrowUpward,
  ThirdStateCheck: Remove,
  ViewColumn: ViewColumn
};

const useStyles = makeStyles(theme => ({
  button: {
    color: CustomTheme.palette.secondary.main,
    fontSize: "17px",
    "&:hover": {
      color: CustomTheme.palette.secondary.dark,
      backgroundColor: CustomTheme.palette.primary.main
    },
    fontWeight: "300"
  },
  input: {
    display: "none"
  },
  error: {
    color: CustomTheme.palette.primary.contrastText,
    fontSize: "15px",
    fontWeight: "300",
    marginTop: theme.spacing(2),
    textAlign: "center"
  }
}));

function Table(props) {
  const classes = useStyles();

  const [state, setState] = React.useState(props.data);

  const [errors, setErrors] = React.useState({ emptyDeck: null });

  React.useEffect(() => {
    setState(props.data);
  }, [props.data]);

  const [isBrowsingCardsState, setIsBrowsingCardsState] = React.useState(false);

  var isActionHidden = isBrowsingCardsState;

  // placement of action buttons,
  // in deck view we want them on the far right, ie -1
  // in card view we want them on far left, ie 0
  // this is mainly to facilitate the experience on mobile
  var actionsColumnIndex;
  if (!isBrowsingCardsState) {
    actionsColumnIndex = -1;
  } else {
    actionsColumnIndex = 0;
  }

  return (
    <React.Fragment>
      <MaterialTable
        icons={tableIcons}
        title={state.title}
        columns={state.columns}
        data={state.data}
        editable={{
          onRowAdd: newData =>
            new Promise(resolve => {
              setTimeout(async () => {
                resolve();
                const data = [...state.data];
                // trim all inputs
                for (let key of Object.keys(newData)) {
                  newData[key] = newData[key].trim();
                }
                data.push(newData);
                setState({ ...state, data });

                // add deck to database
                try {
                  if (!isBrowsingCardsState) {
                    props.setDeckData({ ...state, data });
                    await addDeck({
                      input: {
                        name: newData.name,
                        description: newData.description || ""
                      }
                    });
                  } else {
                    let now = Math.floor(new Date().getTime() / ms("1h"));
                    await addCard({
                      input: {
                        prompt: newData.prompt,
                        target: newData.target,
                        promptExample: newData.promptExample || "",
                        targetExample: newData.targetExample || "",
                        timeAdded: now,
                        nextReview: now,
                        intervalProgress: 0,
                        deckId: state.deckId
                      }
                    });
                  }
                } catch (e) {
                  console.log(e);
                }
              }, 600);
            }),
          onRowUpdate: (newData, oldData) =>
            new Promise(resolve => {
              setTimeout(async () => {
                resolve();
                const data = [...state.data];
                data[data.indexOf(oldData)] = newData;
                setState({ ...state, data });

                if (!isBrowsingCardsState) {
                  props.setDeckData({ ...state, data });
                  await updateDeckInDB(oldData, newData);
                } else {
                  await updateCardInDB(oldData, newData, state.deckId);
                }
              }, 600);
            }),
          onRowDelete: oldData =>
            new Promise(resolve => {
              setTimeout(async () => {
                resolve();
                const data = [...state.data];
                data.splice(data.indexOf(oldData), 1);
                setState({ ...state, data });

                var id, variables;

                try {
                  if (!isBrowsingCardsState) {
                    props.setDeckData({ ...state, data });
                    id = await getDeckId(oldData.name);
                    variables = { id };
                    await removeDeck(variables);
                  } else {
                    id = await getCardId(oldData.prompt, state.deckId);
                    variables = { id };
                    await removeCard(variables);
                  }
                } catch (e) {
                  console.log(e);
                }
              }, 600);
            })
        }}
        actions={[
          {
            icon: OfflineBolt,
            tooltip: "Study",
            hidden: isActionHidden,
            onClick: async (event, rowData) => {
              setErrors({ emptyDeck: null });
              var deckId = await getDeckId(rowData.name);
              var data = await client.query({
                query: cardsQueryWithProgress,
                variables: { deckId },
                fetchPolicy: "no-cache"
              });
              var allCards = data.data.cards;
              var overDueCards = allCards.filter(
                card =>
                  card.nextReview <= Math.floor(new Date().getTime() / ms("1h"))
              );
              if (overDueCards.length == 0) {
                // calculate in how long another card will be ready for review
                let nextReviewTime = data.data.cards.reduce((acc, card) => {
                  acc = card.nextReview < acc ? card.nextReview : acc;
                  return acc;
                }, data.data.cards[0].nextReview);
                let now = Math.floor(new Date().getTime() / ms("1h"));
                let nextReviewFromNow = nextReviewTime - now;
                let nextReviewTimeString;
                if (nextReviewFromNow > 24) {
                  nextReviewFromNow = Math.floor(nextReviewFromNow / 24);
                  nextReviewTimeString = `${nextReviewFromNow} ${
                    nextReviewFromNow == 1 ? "day" : "days"
                  }`;
                } else {
                  nextReviewTimeString = `${nextReviewFromNow} ${
                    nextReviewFromNow == 1 ? "hour" : "hours"
                  }`;
                }
                setErrors({
                  emptyDeck: `Sorry, this deck has no cards scheduled for review at this time. Check back in ${nextReviewTimeString}.`
                });
              } else {
                let overDueCardsSorted = overDueCards.sort(
                  (a, b) => a.timeAdded - b.timeAdded
                );
                props.setStudyState({
                  isStudying: true,
                  deckId,
                  cards: overDueCardsSorted
                });
              }
            }
          },
          {
            icon: Search,
            tooltip: "Browse",
            hidden: isActionHidden,
            onClick: async (event, rowData) => {
              setErrors({ emptyDeck: null });
              var deckId = await getDeckId(rowData.name);
              var variables = { deckId };
              var data = await client.query({
                query: cardsQuery,
                variables,
                fetchPolicy: "no-cache"
              });
              var cards = data.data.cards;
              var cardData = {
                title: `Cards in ${rowData.name}`,
                columns: [
                  { title: "Prompt", field: "prompt" },
                  { title: "Target", field: "target" },
                  { title: "Prompt Example", field: "promptExample" },
                  { title: "Target Example", field: "targetExample" }
                ],
                data: cards,
                deckId
              };
              setIsBrowsingCardsState(true);
              setState(cardData);
              actionsColumnIndex = 0;
            }
          }
        ]}
        options={{
          actionsColumnIndex: actionsColumnIndex,
          exportButton: true,
          exportFileName: "never-forget-export.csv"
        }}
      />
      {isBrowsingCardsState == true && (
        <div
          onClick={() => {
            setIsBrowsingCardsState(false);
            setState(props.data);
          }}
          align="center"
        >
          <IconButton className={classes.button}>
            <ArrowBackOutlinedIcon /> Return to decks
          </IconButton>
        </div>
      )}
      <div className={classes.error}>{errors.emptyDeck}</div>
    </React.Fragment>
  );
}

export default Table;

import { io } from 'socket.io-client';
import './App.css';
import { useEffect, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Grid, InputLabel, MenuItem, Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { ExpandMore } from '@mui/icons-material';
import Decimal from 'decimal.js';

function App() {
  const [prices, setPrices] = useState([]);
  const [token0s, setToken0s] = useState([]);
  const [token1s, setToken1s] = useState([]);
  const [token0Filter, setToken0Filter] = useState('');
  const [token1Filter, setToken1Filter] = useState('');
  const [expanded, setExpanded] = useState('');

  function calculatePrice(price, token) {
    const tokenSum = Decimal.sum(...Object.values(price).map((it) => new Decimal(it[`${token}Price`])));
    const poolSize = new Decimal(Object.keys(price).length);
    const result = tokenSum.div(poolSize)
      .toSignificantDigits(5, Decimal.ROUND_HALF_UP);
    return result.toString();
  }

  useEffect(() => {
    const socket = io('ws://localhost:3000', {
      reconnectionDelayMax: 10000,
    });
    socket.connect();
    socket.once('pairs', (pairs) => {
      setToken0s(Array.of(...new Set(pairs.map((it) => it.token0.symbol))));
      setToken1s(Array.of(...new Set(pairs.map((it) => it.token1.symbol))));
    });
    socket.on('prices', (prices) => {
      setPrices(Object.entries(prices));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <Grid container flexDirection='column' className='App'>
      <Grid item>
        <InputLabel id="pair-select-label">Token0</InputLabel>
        <Select
          labelId="pair-select-label"
          id="pair-select"
          value={token0Filter}
          onChange={(event) => setToken0Filter(event.target.value)}
          sx={{
            minWidth: '300px'
          }}
        >
          {token0s.map((it, index) => (
            <MenuItem key={`token0-${it}-${index}`} value={it}>{it}</MenuItem>
          ))}
        </Select>
        <InputLabel id="pair-select-label">Token1</InputLabel>
        <Select
          labelId="pair-select-label"
          id="pair-select"
          value={token1Filter}
          onChange={(event) => setToken1Filter(event.target.value)}
          sx={{
            minWidth: '300px'
          }}
        >
          {token1s.map((it, index) => (
            <MenuItem key={`token1-${it}-${index}`} value={it}>{it}</MenuItem>
          ))}
        </Select>
      </Grid>
      <Grid item>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell colSpan={4}>
                  <Grid container flexDirection='row' justifyContent='space-between'>
                    <Grid item>Index</Grid>
                    <Grid item>Pair</Grid>
                    <Grid item>Token0 price</Grid>
                    <Grid item>Token1 price</Grid>
                  </Grid>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {prices.filter(([pair]) => {
                let containsToken0 = true
                let containsToken1 = true
                if (token0Filter) {
                  containsToken0 = pair.startsWith(token0Filter)
                }
                if (token1Filter) {
                  containsToken1 = pair.endsWith(token1Filter)
                }
                return containsToken0 && containsToken1
              }).map(([pair, price], index) => (
                <TableRow key={pair}>
                  <TableCell colSpan={4}>
                    <Accordion expanded={expanded === pair} onChange={() => setExpanded(expanded === pair ? '' : pair)}>
                      <AccordionSummary
                        expandIcon={<ExpandMore />}
                      >
                        <Grid container flexDirection='row' justifyContent='space-between'>
                          <Grid item>{index}</Grid>
                          <Grid item>{pair}</Grid>
                          <Grid item>{calculatePrice(price, 'token0')}</Grid>
                          <Grid item>{calculatePrice(price, 'token1')}</Grid>
                        </Grid>
                      </AccordionSummary>
                      <AccordionDetails>
                        <TableContainer>
                          <Table>
                            <TableHead>
                              <TableRow>
                                <TableCell>Pool address</TableCell>
                                <TableCell>Pair</TableCell>
                                <TableCell>Token0 price</TableCell>
                                <TableCell>Token1 price</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {Object.entries(price).map(([address, pairs]) => (<TableRow>
                                <TableCell>{address}</TableCell>
                                <TableCell>{pairs.pair}</TableCell>
                                <TableCell>{pairs.token0Price}</TableCell>
                                <TableCell>{pairs.token1Price}</TableCell>
                              </TableRow>))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </AccordionDetails>
                    </Accordion>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Grid>
    </Grid>
  );
}

export default App;
